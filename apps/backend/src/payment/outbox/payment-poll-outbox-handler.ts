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
 * Publishes a durably-recorded `payment.attempt.poll_requested` outbox row
 * to BullMQ, same "make sure BullMQ has this job" role
 * `PaymentAttemptOutboxHandler` plays for the initial charge — except this
 * one fires repeatedly for the life of one attempt (see
 * `../providers/bakong/README.md`).
 *
 * The BullMQ `delay` is what actually paces the poll loop — the outbox row
 * itself is dispatched as soon as a worker picks it up; delaying *when the
 * job runs* rather than *when it's published* keeps the outbox's own
 * due/backoff machinery, which already has its own opinions about timing,
 * out of this.
 *
 * `jobId` is the outbox event's own id, not the attempt id (contrast
 * `PaymentAttemptOutboxHandler`, which uses `paymentAttemptId` as a
 * one-shot dedupe key). A fixed `paymentAttemptId` jobId would collide
 * across rounds — the whole point here is that the *same* attempt gets
 * many of these jobs over its lifetime, one per round, each needing its own
 * BullMQ job.
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
