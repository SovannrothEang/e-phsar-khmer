import { Effect } from 'effect';
import { DbClientTag } from '../../db/db.provider';
import {
  paymentAttempts,
  paymentAttemptMethodEnum,
  type PaymentAttemptRow,
} from '../entity/payment-attempt';
import { PaymentPersistenceError } from './errors';

export interface CreatePaymentAttemptInput {
  paymentTransactionId: string;
  provider: string;
  method: (typeof paymentAttemptMethodEnum.enumValues)[number];
  amount: string;
  currency: string;
}

type CreatePaymentAttemptError = PaymentPersistenceError;

/**
 * Inserts a pending payment_attempt under an existing payment_transaction —
 * the last write before a job would be enqueued to BullMQ. Nothing here
 * talks to a provider; that only happens once the (not yet built) queue
 * processor picks the job up.
 */
export const createPaymentAttempt = Effect.fn('createPaymentAttempt')(
  function* (
    input: CreatePaymentAttemptInput,
  ): Effect.fn.Return<
    PaymentAttemptRow,
    CreatePaymentAttemptError,
    DbClientTag
  > {
    const db = yield* DbClientTag;
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(paymentAttempts)
          .values({
            paymentTransactionId: input.paymentTransactionId,
            provider: input.provider,
            method: input.method,
            amount: input.amount,
            currency: input.currency,
          })
          .returning(),
      catch: (cause) => new PaymentPersistenceError({ cause }),
    });
    const [row] = rows;
    return row;
  },
);
