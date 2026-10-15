import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, gte, inArray, isNotNull, or } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { OutboxService } from '../../outbox/outbox.service';
import { subscriptionPurchases } from '../../db/schema/subscriptions.schema';
import { SubscriptionActivationService } from '../../subscriptions/subscription-activation.service';
import { paymentAttempts, paymentTransactions } from '../entity';
import { PaymentGatewayRegistry } from '../providers/payment-gateway.registry';
import { RECOVERABLE_FAILURE_CODES, isDueThisTick } from './reconcile-policy';
import { runReconcileAttempt } from './run-reconcile-attempt';

/** Attempts younger than this are checked every tick; older ones less often. */
const FAST_WINDOW_MS = 30 * 60 * 1000;
/** With a 15 s tick, every 20th tick is every 5 minutes for the long tail. */
const SLOW_EVERY_TICKS = 20;
/** Most attempts looked at per tick — bounds provider calls per cycle. */
const BATCH_LIMIT = 100;

export interface ReconcileSummary {
  checked: number;
  settled: number;
  /** Purchases activated for a payment that had already settled. */
  activated: number;
  abandoned: number;
  errors: number;
}

/**
 * The guarantee behind "money taken ⇒ plan activated", whatever the app was
 * doing when the payer paid.
 *
 * The BullMQ poll chain (`pollPaymentAttempt`) is only the fast path: it is a
 * self-rescheduling chain, so one lost link — a crash between rounds, a job
 * published into a queue nobody consumes — strands the attempt `pending`
 * forever, even though the provider already holds the money. This service
 * does not depend on any of that. On a timer it reads every unresolved
 * attempt straight from Postgres, asks the provider, and settles through the
 * same idempotent path the poll uses.
 *
 * Why this is safe to run on every instance and alongside the poll chain:
 * settlement is version-guarded (`upsertPayment`), the ledger post is keyed on
 * the transaction id, and the `payment.succeeded` event has a dedupe key — a
 * racing reconciler/poll loses with a conflict and rolls back whole. The
 * worst case of two instances is one redundant provider call.
 *
 * It also revisits attempts we ourselves failed by timeout (`POLL_EXPIRED` /
 * `POLL_GATEWAY_ERROR`) for a grace window, so money that arrives late still
 * counts — an attempt is never failed *because* we couldn't see the payment.
 */
@Injectable()
export class PaymentReconciler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentReconciler.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private tickCount = 0;

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly registry: PaymentGatewayRegistry,
    private readonly outbox: OutboxService,
    private readonly activation: SubscriptionActivationService,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (
      this.configService.get<boolean>('payment.reconcilerEnabled') === false
    ) {
      this.logger.log('Payment reconciler disabled by configuration');
      return;
    }

    const intervalMs = this.intervalMs();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref?.();
    this.logger.log(
      `Payment reconciler started (every ${intervalMs}ms, providers: ${this.providers().join(', ') || 'none'})`,
    );
    // Don't wait a full interval after boot: a payment made while the app was
    // down is picked up as soon as it is back.
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One timer tick. Never throws, and never overlaps a still-running one. */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.tickCount += 1;
    try {
      const summary = await this.runOnce(this.tickCount);
      if (
        summary.settled ||
        summary.activated ||
        summary.abandoned ||
        summary.errors
      ) {
        this.logger.log(
          `Reconcile: checked ${summary.checked}, settled ${summary.settled}, activated ${summary.activated}, abandoned ${summary.abandoned}, errors ${summary.errors}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Reconcile tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * One pass over every unresolved attempt that is due. Exposed for tests and
   * for an operator-triggered run; the timer is just this on a loop.
   */
  async runOnce(tick = 0): Promise<ReconcileSummary> {
    const summary: ReconcileSummary = {
      checked: 0,
      settled: 0,
      activated: 0,
      abandoned: 0,
      errors: 0,
    };

    // Last hop first: a payment that already settled but whose purchase never
    // activated (the `payment.succeeded` event was consumed by an instance
    // that only notified, or lost) is finished here, with no provider call.
    summary.activated = await this.activateSettledPurchases();

    const providers = this.providers();
    if (providers.length === 0) return summary;

    const now = Date.now();
    const since = new Date(now - this.latePaymentGraceMs());
    const candidates = await this.db
      .select({
        id: paymentAttempts.id,
        createdAt: paymentAttempts.createdAt,
      })
      .from(paymentAttempts)
      .where(
        and(
          inArray(paymentAttempts.provider, providers),
          isNotNull(paymentAttempts.providerAttemptId),
          gte(paymentAttempts.createdAt, since),
          or(
            eq(paymentAttempts.status, 'pending'),
            and(
              eq(paymentAttempts.status, 'failed'),
              inArray(paymentAttempts.failureCode, [
                ...RECOVERABLE_FAILURE_CODES,
              ]),
            ),
          ),
        ),
      )
      .orderBy(asc(paymentAttempts.createdAt))
      .limit(BATCH_LIMIT);

    for (const candidate of candidates) {
      const ageMs = now - candidate.createdAt.getTime();
      if (
        !isDueThisTick(ageMs, tick, {
          fastWindowMs: FAST_WINDOW_MS,
          slowEveryTicks: SLOW_EVERY_TICKS,
        })
      ) {
        continue;
      }

      summary.checked += 1;
      const outcome = await runReconcileAttempt(
        {
          db: this.db,
          registry: this.registry,
          outbox: this.outbox,
          logger: this.logger,
        },
        {
          paymentAttemptId: candidate.id,
          abandonPendingAfterMs: this.pendingAbandonMs(),
        },
      );
      if (outcome === 'succeeded') summary.settled += 1;
      else if (outcome === 'abandoned') summary.abandoned += 1;
      else if (outcome === 'error') summary.errors += 1;
    }

    // Settling enqueued `payment.succeeded` rows (activation + notification);
    // wake the outbox rather than leave them to its poll fallback.
    if (summary.settled > 0) this.outbox.wakeupAfterCommit();

    return summary;
  }

  /**
   * Activates every subscription purchase whose payment has already settled
   * but which is still `pending`. `activatePaidPurchase` re-verifies owner,
   * amount and currency and is a no-op once the purchase is paid, so this is
   * safe to repeat every tick and to race with the outbox handler.
   */
  private async activateSettledPurchases(): Promise<number> {
    const stuck = await this.db
      .select({
        purchaseId: subscriptionPurchases.id,
        paymentTransactionId: paymentTransactions.id,
        customerId: paymentTransactions.customerId,
        amount: paymentTransactions.amount,
        currency: paymentTransactions.currency,
      })
      .from(subscriptionPurchases)
      .innerJoin(
        paymentTransactions,
        eq(paymentTransactions.id, subscriptionPurchases.paymentTransactionId),
      )
      .where(
        and(
          eq(subscriptionPurchases.status, 'pending'),
          eq(paymentTransactions.status, 'succeeded'),
        ),
      )
      .limit(BATCH_LIMIT);

    let activated = 0;
    for (const row of stuck) {
      try {
        const result = await this.activation.activatePaidPurchase(row);
        if (result.status === 'activated') {
          activated += 1;
          this.logger.log(
            `Activated purchase ${row.purchaseId} for settled payment ${row.paymentTransactionId}`,
          );
        } else if (
          result.status === 'payment_mismatch' ||
          result.status === 'not_found'
        ) {
          this.logger.warn(
            `Settled payment ${row.paymentTransactionId} cannot activate purchase ${row.purchaseId} (${result.status}) — needs manual review`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Activation of purchase ${row.purchaseId} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return activated;
  }

  private providers(): string[] {
    return this.configService.get<string[]>('payment.reconcileProviders') ?? [];
  }

  private intervalMs(): number {
    return (
      this.configService.get<number>('payment.reconcileIntervalMs') ?? 15_000
    );
  }

  private pendingAbandonMs(): number {
    return (
      this.configService.get<number>('payment.pendingAbandonMs') ??
      15 * 60 * 1000
    );
  }

  private latePaymentGraceMs(): number {
    return (
      this.configService.get<number>('payment.latePaymentGraceMs') ??
      24 * 60 * 60 * 1000
    );
  }
}
