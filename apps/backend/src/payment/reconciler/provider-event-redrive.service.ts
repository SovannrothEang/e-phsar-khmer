import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { outboxEvents } from '../../db/schema/outbox.schema';
import { OutboxService } from '../../outbox/outbox.service';
import { paymentProviderEvents } from '../entity';
import { PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE } from '../outbox/payment-outbox-events';

/**
 * A `received` event this old has already outlived the BullMQ job's whole
 * retry budget (3 attempts, 5 s exponential backoff) and the outbox's own
 * five-attempt budget, so its row being still `received` means the job
 * dead-lettered rather than that it is in flight. Five minutes (not two)
 * leaves room for a backlogged queue before the first re-drive is spent.
 */
export const STALE_PROVIDER_EVENT_MS = 5 * 60 * 1000;
/**
 * How often the re-drive sweep runs. Two sweeps a minute would spend the
 * three-attempt budget in ~2 minutes while the queue is merely slow; five
 * minutes gives each attempt a realistic chance to drain first.
 */
export const PROVIDER_EVENT_REDRIVE_INTERVAL_MS = 5 * 60 * 1000;
/** Most stale events looked at per sweep; each one costs one outbox insert. */
export const PROVIDER_EVENT_REDRIVE_BATCH = 20;
/** Re-drives a single event gets before it is left for an operator. */
export const MAX_PROVIDER_EVENT_REDRIVES = 3;
/**
 * Ingestion rows live this long. The dedupe guarantee on
 * (provider, providerEventId) therefore lasts exactly this window: an event
 * replayed after it would look new and be enqueued again. Providers retry a
 * webhook for hours, never weeks, so 30 days is far beyond any real replay.
 * It also bounds the table: settled/ignored/failed rows are deleted at this
 * age, while a still-`received` row is deliberately kept as evidence for an
 * operator (those are rare — the re-drive sweep is the normal recovery).
 */
export const PROVIDER_EVENT_RETENTION_DAYS = 30;
const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_BATCH_LIMIT = 500;
/** Caps one hourly sweep so a large first backlog cannot hog the pool. */
const RETENTION_MAX_BATCHES = 5;
/**
 * Redrive rows are keyed `payment-event-redrive:<eventId>:<attemptNo>`, so the
 * attempt number survives restarts and is shared by every instance without a
 * new column on `payment_provider_events`.
 *
 * The counter is only as durable as those outbox rows: `OutboxRetention`
 * purges *published* ones after `OUTBOX_RETENTION_DAYS` (7 by default), so an
 * event still `received` a week later starts a fresh burst of three. That is
 * deliberate — a week-old row is a new incident, not a retry of the same one —
 * and the 30-day `payment_provider_events` retention is the hard stop.
 */
const REDRIVE_DEDUPE_PREFIX = 'payment-event-redrive';
/** Bounds the one-log-per-event memory when many events exhaust the budget. */
const EXHAUSTED_LOG_MEMORY = 10_000;

export interface ProviderEventSweepResult {
  redriven: number;
  exhausted: number;
  purged: number;
}

/**
 * Recovers `payment_provider_events` rows stranded by a dead-lettered BullMQ
 * job, and keeps the table from growing without bound.
 *
 * Why a re-drive is needed at all: the webhook intake writes the row as
 * `received` and hands its id to the outbox, which publishes a BullMQ job. If
 * that job exhausts its own retry budget (`payment.processor.ts` explicitly
 * leaves such a row alone) nothing ever looks at it again, so the payment it
 * carried never settles. This sweep re-enqueues the *same* durable path the
 * webhook uses — a fresh `payment.provider_event.received` outbox row — which
 * `PaymentEventOutboxHandler` publishes and `processProviderEvent` consumes.
 * `receivePaymentProviderEvent` is deliberately not reused: it dedupes on
 * (provider, providerEventId) and would no-op on the existing row.
 *
 * The row stays `received` throughout. That is the state `processProviderEvent`
 * acts on; nothing would consume a "redriving" status, and retention deletes
 * the row at 30 days whether or not the re-drives worked.
 *
 * A re-drive is a duplicate delivery, not a mutex: if the original job was
 * merely slow, both run. Settlement is idempotent and version-guarded, so the
 * loser is a conflict or a `skipped` on the already-advanced row.
 */
@Injectable()
export class ProviderEventRedrive {
  private readonly logger = new Logger(ProviderEventRedrive.name);
  /** Epoch ms of the last re-drive sweep; `0` means due now. */
  private lastRedriveAt = 0;
  /** Epoch ms of the last retention sweep; `0` means due now. */
  private lastRetentionAt = 0;
  /** Events already reported as exhausted, so the log is not repeated every minute. */
  private readonly exhaustedLogged = new Set<string>();

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * One housekeeping pass, called from `PaymentReconciler.runOnce()`. Each
   * half keeps its own cadence: re-drives run at most once a minute, retention
   * at most once an hour (a 30-day delete has no reason to run on the
   * reconciler's idle clock). Never throws.
   */
  async sweep(now: number): Promise<ProviderEventSweepResult> {
    const result: ProviderEventSweepResult = {
      redriven: 0,
      exhausted: 0,
      purged: 0,
    };

    if (now - this.lastRetentionAt >= RETENTION_INTERVAL_MS) {
      this.lastRetentionAt = now;
      result.purged = await this.purgeOldEvents();
    }

    if (now - this.lastRedriveAt < PROVIDER_EVENT_REDRIVE_INTERVAL_MS) {
      return result;
    }
    this.lastRedriveAt = now;

    const redrive = await this.redriveStaleEvents(now);
    result.redriven = redrive.redriven;
    result.exhausted = redrive.exhausted;
    return result;
  }

  private async redriveStaleEvents(
    now: number,
  ): Promise<Pick<ProviderEventSweepResult, 'redriven' | 'exhausted'>> {
    const stale = await this.db
      .select({ id: paymentProviderEvents.id })
      .from(paymentProviderEvents)
      .where(
        and(
          eq(paymentProviderEvents.status, 'received'),
          lt(
            paymentProviderEvents.receivedAt,
            new Date(now - STALE_PROVIDER_EVENT_MS),
          ),
        ),
      )
      .orderBy(asc(paymentProviderEvents.receivedAt))
      .limit(PROVIDER_EVENT_REDRIVE_BATCH);

    if (stale.length === 0) return { redriven: 0, exhausted: 0 };

    // One query for the whole batch: which attempt number the previous
    // re-drives reached, and whether the newest one is still waiting to be
    // published. The attempt number comes from the dedupe key, not a column.
    const prior = await this.db
      .select({
        eventId: outboxEvents.aggregateId,
        status: outboxEvents.status,
        dedupeKey: outboxEvents.dedupeKey,
      })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.eventType, PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE),
          inArray(
            outboxEvents.aggregateId,
            stale.map((row) => row.id),
          ),
          sql`${outboxEvents.dedupeKey} like ${`${REDRIVE_DEDUPE_PREFIX}:%`}`,
        ),
      )
      .orderBy(asc(outboxEvents.createdAt))
      .limit(PROVIDER_EVENT_REDRIVE_BATCH * MAX_PROVIDER_EVENT_REDRIVES);

    const progress = new Map<string, { attempt: number; status: string }>();
    for (const row of prior) {
      const attempt = Number.parseInt(
        row.dedupeKey?.split(':').pop() ?? '',
        10,
      );
      if (!Number.isFinite(attempt)) continue;
      const current = progress.get(row.eventId);
      if (!current || attempt > current.attempt) {
        progress.set(row.eventId, { attempt, status: row.status });
      }
    }

    let redriven = 0;
    let exhausted = 0;
    for (const event of stale) {
      const previous = progress.get(event.id);

      // A re-drive row already waiting to be published (or in flight) is this
      // event's turn: adding another would only race the dispatcher.
      if (
        previous &&
        (previous.status === 'pending' || previous.status === 'processing')
      ) {
        continue;
      }

      if (previous && previous.attempt >= MAX_PROVIDER_EVENT_REDRIVES) {
        exhausted += 1;
        this.logExhausted(event.id);
        continue;
      }

      const attempt = (previous?.attempt ?? 0) + 1;
      try {
        await this.outbox.enqueue(this.db, {
          eventType: PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE,
          aggregateType: 'payment_provider_event',
          aggregateId: event.id,
          payload: {
            paymentProviderEventId: event.id,
            redriveAttempt: attempt,
          },
          dedupeKey: `${REDRIVE_DEDUPE_PREFIX}:${event.id}:${attempt}`,
        });
        redriven += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Could not re-drive provider event ${event.id}: ${message}`,
        );
      }
    }

    if (redriven > 0) {
      this.logger.log(`Re-driven ${redriven} stale provider event(s)`);
      // The enqueue is committed; wake the dispatcher instead of waiting for
      // its poll fallback. Same call the webhook path makes after commit.
      this.outbox.wakeupAfterCommit();
    }
    if (exhausted > 0) {
      this.logger.warn(
        `${exhausted} provider event(s) remain stuck after ${MAX_PROVIDER_EVENT_REDRIVES} re-drives`,
      );
    }

    return { redriven, exhausted };
  }

  /** One error line per event, ever (within this process); payload never read. */
  private logExhausted(eventId: string): void {
    if (this.exhaustedLogged.has(eventId)) return;
    if (this.exhaustedLogged.size >= EXHAUSTED_LOG_MEMORY) {
      // The set is only an anti-spam memory, so dropping it is safe: an event
      // still stuck is re-reported once, which beats unbounded growth.
      this.exhaustedLogged.clear();
    }
    this.exhaustedLogged.add(eventId);
    this.logger.error(
      `Provider event ${eventId} is still 'received' after ${MAX_PROVIDER_EVENT_REDRIVES} re-drives; leaving it for manual review`,
    );
  }

  /**
   * Deletes provider events older than the documented 30-day dedupe window,
   * in batches, binding the window to the database clock (the same rule the
   * outbox retention sweep uses). `skip locked` keeps concurrent sweepers from
   * queueing behind each other. Never throws.
   */
  private async purgeOldEvents(): Promise<number> {
    let total = 0;
    try {
      for (let i = 0; i < RETENTION_MAX_BATCHES; i++) {
        const deleted = await this.db
          .delete(paymentProviderEvents)
          .where(
            sql`${paymentProviderEvents.id} in (
              select ${paymentProviderEvents.id} from ${paymentProviderEvents}
              where ${paymentProviderEvents.receivedAt} < now() - make_interval(days => ${PROVIDER_EVENT_RETENTION_DAYS})
                and ${paymentProviderEvents.status} <> 'received'
              order by ${paymentProviderEvents.receivedAt}
              for update skip locked
              limit ${RETENTION_BATCH_LIMIT}
            )`,
          )
          .returning({ id: paymentProviderEvents.id });
        total += deleted.length;
        if (deleted.length < RETENTION_BATCH_LIMIT) break;
      }
      if (total > 0) {
        this.logger.log(
          `Purged ${total} provider event(s) older than ${PROVIDER_EVENT_RETENTION_DAYS}d`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Provider event retention failed: ${message}`);
    }
    return total;
  }
}
