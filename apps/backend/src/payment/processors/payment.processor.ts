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
 * Consumes all three job kinds on the `payments` queue. Deliberately thin —
 * every decision belongs to the use-case; this only turns a modeled failure
 * into a throw, which asks BullMQ's `attempts`/`backoff` for a retry (no
 * `HttpException` mapping here, unlike `PaymentEffectRunner.run()` — there's
 * no HTTP response to produce). `onJobFailed` below is the backstop once
 * BullMQ's retry budget runs out.
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
        // Any of the three job kinds can now have written a new outbox row
        // — either the existing poll-scheduling (this one, PAYMENT_POLL_JOB)
        // or a `payment.succeeded` settlement announcement (all three, on a
        // success transition — see enqueuePaymentSettledEvent). Waking
        // unconditionally is harmless: an idle worker just finds nothing due.
        this.outboxService.wakeupAfterCommit();
        return result;
      }
      case PAYMENT_EVENT_JOB: {
        const result = await this.run(
          processProviderEvent(
            this.outboxService,
            job.data as ProcessProviderEventJobData,
          ),
        );
        this.outboxService.wakeupAfterCommit();
        return result;
      }
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
   * Fires on every failed attempt, not just the final one — the
   * `attemptsMade < maxAttempts` check below is what distinguishes "will
   * retry" from "BullMQ has given up." Only `process-attempt`/`poll-attempt`
   * jobs carry enough context to act on; a `process-provider-event` job
   * exhausting its retries is left alone, staying `received` for an
   * operator to investigate. Errors here are logged, not thrown — this runs
   * outside `process()`, so a throw would just be an unhandled rejection.
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
