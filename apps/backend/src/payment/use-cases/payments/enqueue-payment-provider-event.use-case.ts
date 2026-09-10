import { Effect } from 'effect';
import { DbClientTag } from '../../../db/db.provider';
import type { OutboxService } from '../../../outbox/outbox.service';
import { PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE } from '../../outbox/payment-outbox-events';
import type { ProcessProviderEventJobData } from '../../queue/payment-queue.types';
import { PaymentQueueError } from './errors';

type EnqueuePaymentProviderEventError = PaymentQueueError;

/**
 * Durably hands a newly-received payment_provider_event off for processing.
 * Only ever called for a genuinely new event; a duplicate webhook delivery
 * never reaches here. Same durable-handoff pattern and the same reason
 * `outbox` is a plain parameter rather than a service tag — see
 * `enqueue-payment-attempt.use-case.ts`'s doc comment.
 */
export const enqueuePaymentProviderEvent = Effect.fn(
  'enqueuePaymentProviderEvent',
)(function* (
  outbox: OutboxService,
  input: ProcessProviderEventJobData,
): Effect.fn.Return<void, EnqueuePaymentProviderEventError, DbClientTag> {
  const db = yield* DbClientTag;
  yield* Effect.tryPromise({
    try: () =>
      outbox.enqueue(db, {
        eventType: PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE,
        aggregateType: 'payment_provider_event',
        aggregateId: input.paymentProviderEventId,
        payload: input,
        dedupeKey: `payment-provider-event-received:${input.paymentProviderEventId}`,
      }),
    catch: (cause) => new PaymentQueueError({ cause }),
  });
});
