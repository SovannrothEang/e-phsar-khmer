import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { OutboxEventRow } from '../../db/schema/outbox.schema';
import { OutboxRegistry } from '../../outbox/outbox-registry.service';
import type { HandlerOutcome, OutboxHandler } from '../../outbox/outbox.types';
import { NotificationsService } from '../../notifications/notifications.service';
import type { PaymentSettledEventPayload } from '../use-cases/payments/processing/enqueue-payment-settled-event.use-case';
import { PAYMENT_SETTLED_OUTBOX_EVENT_TYPE } from './payment-outbox-events';

/**
 * Consumes `payment.succeeded` and notifies the payment's owner. Unlike the
 * other handlers in this folder, it does the work directly instead of
 * re-queueing to BullMQ — notifying has no gateway call worth isolating
 * behind a worker pool, so the outbox's own retry is durability enough.
 */
@Injectable()
export class PaymentSettledOutboxHandler
  implements OutboxHandler, OnModuleInit
{
  readonly eventType = PAYMENT_SETTLED_OUTBOX_EVENT_TYPE;

  private readonly logger = new Logger(PaymentSettledOutboxHandler.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly registry: OutboxRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEventRow): Promise<HandlerOutcome> {
    const payload = event.payload as PaymentSettledEventPayload;

    // A transaction with no customerId (e.g. a not-yet-modeled system/tenant
    // payment) has no one to notify — that's not a failure to retry.
    if (!payload.customerId) {
      this.logger.warn(
        `payment.succeeded for transaction ${payload.paymentTransactionId} has no customerId — nothing to notify`,
      );
      return { status: 'published' };
    }

    try {
      await this.notifications.notify({
        userId: payload.customerId,
        type: this.eventType,
        title: 'Payment successful',
        body: `Your payment of ${payload.amount} ${payload.currency} has been received.`,
        data: {
          paymentTransactionId: payload.paymentTransactionId,
          ledgerTransactionId: payload.ledgerTransactionId,
          amount: payload.amount,
          currency: payload.currency,
          occurredAt: payload.occurredAt,
        },
      });
      return { status: 'published' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not notify customer for settled transaction ${payload.paymentTransactionId}: ${message}`,
      );
      return { status: 'retry', error: message };
    }
  }
}
