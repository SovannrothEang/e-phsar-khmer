import { Inject, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { DbClientTag } from '../../db/db.provider';
import { OutboxService } from '../../outbox/outbox.service';
import { PaymentGatewayRegistry } from '../providers/payment-gateway.registry';
import { PaymentGatewayRegistryTag } from '../providers/payment-gateway-registry.provider';
import { PAYMENT_QUEUE } from '../payment.constants';
import {
  PAYMENT_ATTEMPT_JOB,
  PAYMENT_EVENT_JOB,
  PAYMENT_POLL_JOB,
  type PaymentJobData,
  type PollAttemptJobData,
  type ProcessAttemptJobData,
  type ProcessProviderEventJobData,
} from '../queue/payment-queue.types';
import {
  processPaymentAttempt,
  processProviderEvent,
  pollPaymentAttempt,
  failAbandonedPaymentJob,
  type PaymentProcessingError,
} from '../use-cases';

/** Cap on how much of a thrown error's message lands in `payment_attempts.failure_message` — plenty for debugging, short of pasting an entire HTML error page into the column. */
const FAILURE_MESSAGE_MAX_LENGTH = 2000;

/**
 * Consumes all three job kinds the `payments` queue carries. Deliberately
 * thin: every decision (claiming via the attempt/event's own status,
 * calling the gateway, persisting) belongs to the use-case; this only
 * translates a modeled failure or a DB error into a throw, which is what
 * asks BullMQ's own `attempts`/`backoff` (wired in `payment.module.ts`) for
 * a retry.
 *
 * Unlike `PaymentsController.run()`, a failure here is never mapped to an
 * `HttpException` — there is no HTTP response to produce, only a job that
 * either completed or needs another try.
 *
 * `onJobFailed` (below) is the backstop for when "another try" runs out: a
 * `process-attempt`/`poll-attempt` job that keeps throwing (bad gateway
 * credentials, a persistent outage) would otherwise leave its attempt
 * silently stuck at `pending` forever once BullMQ's own retry budget is
 * exhausted — indistinguishable from a payer who just hasn't paid yet. See
 * `fail-abandoned-payment-job.use-case.ts`'s doc comment for the full
 * rationale.
 */
// `@Processor`'s options are evaluated at class-decoration time, before Nest's
// DI container exists — ConfigService isn't reachable here, so this reads
// the raw env var directly, same default as `configuration.ts`'s
// `payment.workerConcurrency` (which nothing consumed until this processor
// existed).
const WORKER_CONCURRENCY = Number(process.env.PAYMENT_WORKER_CONCURRENCY) || 5;

@Processor(PAYMENT_QUEUE, { concurrency: WORKER_CONCURRENCY })
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly registry: PaymentGatewayRegistry,
    private readonly outboxService: OutboxService,
  ) {
    super();
  }

  async process(job: Job<PaymentJobData>): Promise<unknown> {
    switch (job.name) {
      case PAYMENT_ATTEMPT_JOB: {
        const result = await this.run(
          processPaymentAttempt(
            this.outboxService,
            job.data as ProcessAttemptJobData,
          ),
        );
        // Only this job kind (and PAYMENT_POLL_JOB below) can have written a
        // new outbox row — see processPaymentAttempt's own doc comment on
        // when a poll gets scheduled. Waking unconditionally is harmless
        // (an idle worker just finds nothing due) but only these two ever
        // have anything to wake for.
        this.outboxService.wakeupAfterCommit();
        return result;
      }
      case PAYMENT_EVENT_JOB:
        return this.run(
          processProviderEvent(job.data as ProcessProviderEventJobData),
        );
      case PAYMENT_POLL_JOB: {
        const result = await this.run(
          pollPaymentAttempt(
            this.outboxService,
            job.data as PollAttemptJobData,
          ),
        );
        this.outboxService.wakeupAfterCommit();
        return result;
      }
      default:
        this.logger.warn(`Ignoring unknown job "${job.name}" (${job.id})`);
        return 'skipped';
    }
  }

  /**
   * Fires on every failed attempt of every job on this queue, not just the
   * final one — `attemptsMade >= opts.attempts` is what distinguishes "will
   * retry" from "BullMQ has given up," per BullMQ's own documented pattern
   * for this listener. Only `process-attempt`/`poll-attempt` jobs carry
   * enough context (a `paymentAttemptId`/`paymentTransactionId`) to act on;
   * `process-provider-event` jobs are left alone; an event exhausting its
   * retries just stays `received` for an operator to investigate, same as
   * today (see `../README.md`'s Current state on `processProviderEvent`).
   *
   * Never lets a failure here propagate: this runs outside `process()`, so
   * a thrown error wouldn't be interpreted as "retry the job" (there is no
   * job attempt in flight anymore) — it would just be an unhandled
   * rejection in a worker event listener. Logged instead.
   */
  @OnWorkerEvent('failed')
  async onJobFailed(
    job: Job<PaymentJobData> | undefined,
    error: Error,
  ): Promise<void> {
    if (
      !job ||
      (job.name !== PAYMENT_ATTEMPT_JOB && job.name !== PAYMENT_POLL_JOB)
    ) {
      return;
    }

    const maxAttempts = job.opts?.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    const data = job.data as ProcessAttemptJobData | PollAttemptJobData;
    const failureCode =
      job.name === PAYMENT_POLL_JOB
        ? 'POLL_GATEWAY_ERROR'
        : 'CHARGE_GATEWAY_ERROR';

    try {
      // No outbox write happens here (a failed attempt schedules nothing
      // further), so unlike the two branches in process(), there's no
      // wakeupAfterCommit() call needed.
      await this.run(
        failAbandonedPaymentJob({
          paymentAttemptId: data.paymentAttemptId,
          paymentTransactionId: data.paymentTransactionId,
          failureCode,
          failureMessage: error.message.slice(0, FAILURE_MESSAGE_MAX_LENGTH),
        }),
      );
    } catch (markErr) {
      this.logger.error(
        `Could not mark abandoned ${job.name} ${job.id} as failed: ` +
          (markErr instanceof Error ? markErr.message : String(markErr)),
      );
    }
  }

  private async run<A>(
    effect: Effect.Effect<
      A,
      PaymentProcessingError,
      DbClientTag | PaymentGatewayRegistryTag
    >,
  ): Promise<A> {
    const layer = Layer.mergeAll(
      DbClientTag.layer(this.db),
      PaymentGatewayRegistryTag.layer(this.registry),
    );
    const exit = await Effect.runPromiseExit(Effect.provide(effect, layer));
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isSome(failure)) {
      throw new Error(
        `${failure.value._tag}: ${JSON.stringify(failure.value)}`,
      );
    }
    throw Cause.squash(exit.cause);
  }
}
