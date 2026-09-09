import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { DbClientTag } from '../../db/db.provider';
import { PaymentGatewayRegistry } from '../providers/payment-gateway.registry';
import { PaymentGatewayRegistryTag } from '../providers/payment-gateway-registry.provider';
import { PAYMENT_QUEUE } from '../payment.constants';
import {
  PAYMENT_ATTEMPT_JOB,
  PAYMENT_EVENT_JOB,
  type PaymentJobData,
  type ProcessAttemptJobData,
  type ProcessProviderEventJobData,
} from '../queue/payment-queue.types';
import { processPaymentAttempt } from '../use-cases/process-payment-attempt.use-case';
import { processProviderEvent } from '../use-cases/process-provider-event.use-case';
import type { PaymentProcessingError } from '../use-cases/errors';

/**
 * Consumes both job kinds the `payments` queue carries. Deliberately thin:
 * every decision (claiming via the attempt/event's own status, calling the
 * gateway, persisting) belongs to the use-case; this only translates a
 * modeled failure or a DB error into a throw, which is what asks BullMQ's
 * own `attempts`/`backoff` (wired in `payment.module.ts`) for a retry.
 *
 * Unlike `PaymentsController.run()`, a failure here is never mapped to an
 * `HttpException` — there is no HTTP response to produce, only a job that
 * either completed or needs another try.
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
  ) {
    super();
  }

  async process(job: Job<PaymentJobData>): Promise<unknown> {
    switch (job.name) {
      case PAYMENT_ATTEMPT_JOB:
        return this.run(
          processPaymentAttempt(job.data as ProcessAttemptJobData),
        );
      case PAYMENT_EVENT_JOB:
        return this.run(
          processProviderEvent(job.data as ProcessProviderEventJobData),
        );
      default:
        this.logger.warn(`Ignoring unknown job "${job.name}" (${job.id})`);
        return 'skipped';
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
