import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { OutboxEventRow } from '../../db/schema/outbox.schema';
import { OutboxRegistry } from '../../outbox/outbox-registry.service';
import type { HandlerOutcome, OutboxHandler } from '../../outbox/outbox.types';
import { PAYMENT_QUEUE } from '../payment.constants';
import {
  PAYMENT_EVENT_JOB,
  type PaymentJobData,
  type ProcessProviderEventJobData,
} from '../queue/payment-queue.types';
import { PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE } from './payment-outbox-events';

/**
 * Publishes a durably-recorded `payment.provider_event.received` outbox row
 * to BullMQ. Same shape and rationale as `PaymentAttemptOutboxHandler` — see
 * its doc comment.
 */
@Injectable()
export class PaymentEventOutboxHandler implements OutboxHandler, OnModuleInit {
  readonly eventType = PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE;

  private readonly logger = new Logger(PaymentEventOutboxHandler.name);

  constructor(
    @InjectQueue(PAYMENT_QUEUE) private readonly queue: Queue<PaymentJobData>,
    private readonly registry: OutboxRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEventRow): Promise<HandlerOutcome> {
    const payload = event.payload as ProcessProviderEventJobData;

    try {
      await this.queue.add(PAYMENT_EVENT_JOB, payload, {
        jobId: payload.paymentProviderEventId,
      });
      return { status: 'published' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not publish event job ${event.id}: ${message}`);
      return { status: 'retry', error: message };
    }
  }
}
