import { Effect } from 'effect';
import { PaymentQueueTag } from '../queue/payment-queue.provider';
import {
  PAYMENT_ATTEMPT_JOB,
  type ProcessAttemptJobData,
} from '../queue/payment-queue.types';
import { PaymentQueueError } from './errors';

type EnqueuePaymentAttemptError = PaymentQueueError;

/**
 * Hands a payment_attempt off to the `payments` queue for processing.
 * This is the last step of the create flow — nothing here calls a provider;
 * that's the (not yet built) processor's job once it picks the job up.
 */
export const enqueuePaymentAttempt = Effect.fn('enqueuePaymentAttempt')(
  function* (
    input: ProcessAttemptJobData,
  ): Effect.fn.Return<void, EnqueuePaymentAttemptError, PaymentQueueTag> {
    const queue = yield* PaymentQueueTag;
    yield* Effect.tryPromise({
      try: () => queue.add(PAYMENT_ATTEMPT_JOB, input),
      catch: (cause) => new PaymentQueueError({ cause }),
    });
  },
);
