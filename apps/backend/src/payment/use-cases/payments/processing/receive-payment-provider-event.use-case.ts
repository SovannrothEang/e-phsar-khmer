import { Effect } from 'effect';
import { and, eq } from 'drizzle-orm';
import { DbClientTag } from '../../../../db/db.provider';
import type { OutboxService } from '../../../../outbox/outbox.service';
import { PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE } from '../../../outbox/payment-outbox-events';
import { paymentProviderEvents } from '../../../entity';
import { PaymentPersistenceError, PaymentQueueError } from '../errors';

export interface ReceivePaymentProviderEventInput {
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: unknown;
  paymentAttemptId?: string;
}

export interface ReceivePaymentProviderEventResult {
  received: true;
  eventId: string;
  isNew: boolean;
}

type ReceivePaymentProviderEventError =
  | PaymentPersistenceError
  | PaymentQueueError;

/**
 * Both webhook intake routes' whole write path (the generic
 * `PaymentsController.webhook()` and ABA PayWay's own controller): dedupe
 * on (provider, providerEventId) — insert-or-fetch-existing, `isNew: false`
 * on a duplicate rather than an error, so a retried webhook is a safe
 * no-op — then durably enqueue only when the event is genuinely new. The
 * dedupe insert and the enqueue used to be two separate use-cases
 * (`createPaymentProviderEvent`, `enqueuePaymentProviderEvent`); folded in
 * here because neither had a second caller.
 */
export const receivePaymentProviderEvent = Effect.fn(
  'receivePaymentProviderEvent',
)(function* (
  outbox: OutboxService,
  input: ReceivePaymentProviderEventInput,
): Effect.fn.Return<
  ReceivePaymentProviderEventResult,
  ReceivePaymentProviderEventError,
  DbClientTag
> {
  const db = yield* DbClientTag;

  const insertedRows = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(paymentProviderEvents)
        .values({
          paymentAttemptId: input.paymentAttemptId ?? null,
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          payload: input.payload,
        })
        .onConflictDoNothing({
          target: [
            paymentProviderEvents.provider,
            paymentProviderEvents.providerEventId,
          ],
        })
        .returning(),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  const [insertedRow] = insertedRows;
  let event = insertedRow;
  let isNew = true;
  if (!event) {
    const existingRows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(paymentProviderEvents)
          .where(
            and(
              eq(paymentProviderEvents.provider, input.provider),
              eq(paymentProviderEvents.providerEventId, input.providerEventId),
            ),
          ),
      catch: (cause) => new PaymentPersistenceError({ cause }),
    });
    event = existingRows[0];
    isNew = false;
  }

  if (isNew) {
    yield* Effect.tryPromise({
      try: () =>
        outbox.enqueue(db, {
          eventType: PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE,
          aggregateType: 'payment_provider_event',
          aggregateId: event.id,
          payload: { paymentProviderEventId: event.id },
          dedupeKey: `payment-provider-event-received:${event.id}`,
        }),
      catch: (cause) => new PaymentQueueError({ cause }),
    });
  }

  return { received: true, eventId: event.id, isNew };
});
