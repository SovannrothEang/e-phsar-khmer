import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient, DbExecutor } from '../db/drizzle.provider';
import { outboxMessages } from '../db/schema';
import { OUTBOX_WAKEUP_EVENT } from './outbox-events';
import type { OutboxWakeupEvent } from './outbox-events';

/**
 * Backoff: `min(BACKOFF_CAP_SECONDS, 2^attempts)` seconds, jittered by
 * ±25%. `attempts` is already incremented by claimBatch, so the first
 * failure waits ~2s, then ~4s, ~8s, ~16s … With the default maxAttempts of 5
 * a message is retried for well under a minute before going `dead`, while a
 * message configured with a large maxAttempts settles at the cap instead of
 * growing unbounded. The jitter keeps a batch that failed together (e.g. a
 * provider outage) from stampeding back at the same instant.
 */
const BACKOFF_CAP_SECONDS = 300;

/** `last_error` is diagnostics, not storage — keep pathological stacks out. */
const MAX_ERROR_LENGTH = 2000;

export interface EnqueueOutboxMessage {
  topic: string;
  payload: Record<string, unknown>;
  /** Partition/ordering key, typically the userId. */
  aggregateId?: string | null;
  /** Optional idempotency key — a repeated enqueue with the same key is a no-op. */
  dedupeKey?: string | null;
  /** Higher runs sooner. */
  priority?: number;
  maxAttempts?: number;
  /** Delay first delivery until this instant. */
  availableAt?: Date;
}

/** The subset of a claimed row the dispatcher needs. */
export interface OutboxRecord {
  id: string;
  topic: string;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

/** Raw `RETURNING *` shape — postgres-js hands back snake_case columns. */
interface ClaimedRow extends Record<string, unknown> {
  id: string;
  topic: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

@Injectable()
export class OutboxService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Insert an outbox row using the CALLER'S transaction handle, so the message
   * is committed atomically with the business write that produced it. That
   * atomicity is the entire point of the outbox — never pass `this.db` here
   * when a surrounding transaction exists.
   *
   * Call `wakeupAfterCommit()` once the transaction has committed.
   */
  async enqueue(tx: DbExecutor, msg: EnqueueOutboxMessage): Promise<void> {
    await tx
      .insert(outboxMessages)
      .values({
        topic: msg.topic,
        payload: msg.payload,
        aggregateId: msg.aggregateId ?? null,
        dedupeKey: msg.dedupeKey ?? null,
        priority: msg.priority ?? 0,
        maxAttempts: msg.maxAttempts ?? 5,
        // Omitted unless explicitly delayed, so the column default (`now()` on
        // the DB clock) applies rather than this process's clock.
        ...(msg.availableAt ? { nextAttemptAt: msg.availableAt } : {}),
      })
      // dedupeKey is nullable and Postgres treats NULLs as distinct, so rows
      // without a key never collide.
      .onConflictDoNothing({ target: outboxMessages.dedupeKey });
  }

  /**
   * Nudge the dispatcher. Call after the enclosing transaction commits —
   * waking it earlier would race the commit and find nothing to claim.
   */
  wakeupAfterCommit(source: OutboxWakeupEvent['source'] = 'transaction'): void {
    const event: OutboxWakeupEvent = { source };
    this.eventEmitter.emit(OUTBOX_WAKEUP_EVENT, event);
  }

  /**
   * Atomically take ownership of up to `limit` due messages.
   *
   * `FOR UPDATE SKIP LOCKED` on the inner SELECT is what makes the worker pool
   * safe: concurrent claimers lock disjoint row sets, so no two workers — in
   * this process or any other instance — can ever claim the same row.
   */
  async claimBatch(limit: number, workerId: string): Promise<OutboxRecord[]> {
    const rows = await this.db.execute<ClaimedRow>(sql`
      update outbox_messages set
        status = 'processing',
        attempts = outbox_messages.attempts + 1,
        locked_by = ${workerId},
        locked_at = now()
      where outbox_messages.id in (
        select m.id from outbox_messages m
        where m.status = 'pending' and m.next_attempt_at <= now()
        order by m.priority desc, m.created_at
        limit ${limit}
        for update skip locked
      )
      returning *
    `);

    return rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      aggregateId: row.aggregate_id,
      payload: row.payload,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
    }));
  }

  /**
   * Mark delivered and DROP THE PAYLOAD. OTP codes, reset links and other
   * short-lived secrets transit this table; once delivered there is no reason
   * for them to keep sitting in a durable, admin-readable row. Only the
   * envelope (topic, aggregate, timings) is retained for debugging.
   */
  async markPublished(id: string): Promise<void> {
    await this.db
      .update(outboxMessages)
      .set({
        status: 'published',
        publishedAt: sql`now()`,
        payload: {},
        lockedBy: null,
        lockedAt: null,
        lastError: null,
      })
      .where(eq(outboxMessages.id, id));
  }

  /**
   * Release a failed message. Exhausted (or explicitly terminal, e.g. an
   * unroutable topic) messages become `dead` and are never retried again;
   * everything else goes back to `pending` with exponential backoff.
   */
  async markFailed(id: string, error: string, terminal = false): Promise<void> {
    await this.db.execute(sql`
      update outbox_messages set
        status = (
          case
            when cast(${terminal} as boolean) or attempts >= max_attempts
              then 'dead'
            else 'pending'
          end
        )::outbox_status,
        next_attempt_at = now() + (
          least(
            cast(${BACKOFF_CAP_SECONDS} as double precision),
            power(2, attempts)
          ) * (0.75 + random() * 0.5)
        ) * interval '1 second',
        last_error = ${error.slice(0, MAX_ERROR_LENGTH)},
        locked_by = null,
        locked_at = null
      where id = ${id}
    `);
  }

  /**
   * Recover rows whose owner died mid-dispatch: they are stuck in
   * `processing` with nobody to finish them. The claim already consumed an
   * attempt, so a message that crashes its worker every time still exhausts
   * its budget instead of looping forever.
   *
   * Returns the number of rows recovered.
   */
  async reclaimStale(olderThanSeconds: number): Promise<number> {
    const rows = await this.db.execute<{ id: string }>(sql`
      update outbox_messages set
        status = (
          case when attempts >= max_attempts then 'dead' else 'pending' end
        )::outbox_status,
        locked_by = null,
        locked_at = null,
        last_error = coalesce(
          last_error,
          'reclaimed: processing lock went stale'
        )
      where status = 'processing'
        and locked_at < now()
          - cast(${olderThanSeconds} as double precision) * interval '1 second'
      returning id
    `);

    return rows.length;
  }
}
