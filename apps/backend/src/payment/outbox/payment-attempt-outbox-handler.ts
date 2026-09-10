import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { OutboxEventRow } from '../../db/schema/outbox.schema';
import { OutboxRegistry } from '../../outbox/outbox-registry.service';
import type { HandlerOutcome, OutboxHandler } from '../../outbox/outbox.types';
import { PAYMENT_QUEUE } from '../payment.constants';
import {
  PAYMENT_ATTEMPT_JOB,
  type PaymentJobData,
  type ProcessAttemptJobData,
} from '../queue/payment-queue.types';
import { PAYMENT_ATTEMPT_OUTBOX_EVENT_TYPE } from './payment-outbox-events';

/**
 * Publishes a durably-recorded `payment.attempt.requested` outbox row to
 * BullMQ. Deliberately thin: this does not call a gateway or touch
 * `payment_attempts` — its only job is "make sure BullMQ has this job",
 * which is what turns the DB-committed intent into an at-least-once BullMQ
 * delivery. `PaymentProcessor` (`../processors/payment.processor.ts`) is
 * what actually processes the job once BullMQ delivers it.
 */
@Injectable()
export class PaymentAttemptOutboxHandler
  implements OutboxHandler, OnModuleInit
{
  readonly eventType = PAYMENT_ATTEMPT_OUTBOX_EVENT_TYPE;

  private readonly logger = new Logger(PaymentAttemptOutboxHandler.name);

  constructor(
    @InjectQueue(PAYMENT_QUEUE) private readonly queue: Queue<PaymentJobData>,
    private readonly registry: OutboxRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEventRow): Promise<HandlerOutcome> {
    const payload = event.payload as ProcessAttemptJobData;

    try {
      // A fixed jobId makes this add idempotent against an outbox retry —
      // BullMQ treats a repeat add() with the same jobId as a no-op rather
      // than a second job.
      await this.queue.add(PAYMENT_ATTEMPT_JOB, payload, {
        jobId: payload.paymentAttemptId,
      });
      return { status: 'published' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not publish attempt job ${event.id}: ${message}`);
      return { status: 'retry', error: message };
    }
  }
}
