import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { OutboxEventRow } from '../../db/schema/outbox.schema';
import { OutboxRegistry } from '../../outbox/outbox-registry.service';
import type { HandlerOutcome, OutboxHandler } from '../../outbox/outbox.types';
import { PAYMENT_QUEUE } from '../payment.constants';
import {
  PAYMENT_POLL_JOB,
  type PaymentJobData,
  type PollAttemptJobData,
} from '../queue/payment-queue.types';
import { PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE } from './payment-outbox-events';

/**
 * Publishes a `payment.attempt.poll_requested` outbox row to BullMQ — same
 * role `PaymentAttemptOutboxHandler` plays for the initial charge, but this
 * fires repeatedly for one attempt's lifetime (see
 * `../providers/bakong/README.md`). The BullMQ `delay` paces the poll loop,
 * not the outbox's own due/backoff timing. `jobId` is the outbox event's
 * own id rather than `paymentAttemptId`, since one attempt produces many of
 * these jobs and a fixed id would collide across rounds.
 */
@Injectable()
export class PaymentPollOutboxHandler implements OutboxHandler, OnModuleInit {
  readonly eventType = PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE;

  private readonly logger = new Logger(PaymentPollOutboxHandler.name);

  constructor(
    @InjectQueue(PAYMENT_QUEUE) private readonly queue: Queue<PaymentJobData>,
    private readonly registry: OutboxRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEventRow): Promise<HandlerOutcome> {
    const payload = event.payload as PollAttemptJobData;

    try {
      await this.queue.add(PAYMENT_POLL_JOB, payload, {
        delay: payload.intervalMs,
        jobId: event.id,
      });
      return { status: 'published' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not publish poll job ${event.id}: ${message}`);
      return { status: 'retry', error: message };
    }
  }
}
