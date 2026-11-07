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
      // A fixed jobId makes a dispatcher retry idempotent. A re-drive must NOT
      // reuse the dead-lettered job's id (BullMQ keeps failed jobs 14 days and
      // treats a repeat add as a no-op), so its attempt number is part of it.
      const jobId = payload.redriveAttempt
        ? `${payload.paymentProviderEventId}-redrive-${payload.redriveAttempt}`
        : payload.paymentProviderEventId;
      await this.queue.add(PAYMENT_EVENT_JOB, payload, { jobId });
      return { status: 'published' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Could not publish event job ${event.id}: ${message}`);
      return { status: 'retry', error: message };
    }
  }

  /**
   * The dispatcher could not publish this event to BullMQ within its retry
   * budget. The provider event row is still `received`, and
   * `ProviderEventRedrive.sweep()` is what re-enqueues it — so this hook only
   * makes the abandonment visible. Payload is deliberately never logged: it is
   * the provider's raw webhook body.
   */
  onAbandoned(event: OutboxEventRow, lastError: string): Promise<void> {
    this.logger.error(
      `Payment provider event outbox row ${event.id} abandoned after ${event.attempts} attempts: ${lastError}`,
    );
    return Promise.resolve();
  }
}
