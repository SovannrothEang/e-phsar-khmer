import { Effect } from 'effect';
import { PaymentQueueTag } from '../queue/payment-queue.provider';
import {
  PAYMENT_EVENT_JOB,
  type ProcessProviderEventJobData,
} from '../queue/payment-queue.types';
import { PaymentQueueError } from './errors';

type EnqueuePaymentProviderEventError = PaymentQueueError;

/**
 * Hands a newly-received payment_provider_event off to the `payments` queue
 * for processing (status-history write, ledger posting, notification —
 * none of that is built yet). Only ever called for a genuinely new event;
 * a duplicate webhook delivery never reaches here.
 */
export const enqueuePaymentProviderEvent = Effect.fn(
  'enqueuePaymentProviderEvent',
)(function* (
  input: ProcessProviderEventJobData,
): Effect.fn.Return<void, EnqueuePaymentProviderEventError, PaymentQueueTag> {
  const queue = yield* PaymentQueueTag;
  yield* Effect.tryPromise({
    try: () => queue.add(PAYMENT_EVENT_JOB, input),
    catch: (cause) => new PaymentQueueError({ cause }),
  });
});
