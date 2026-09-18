import { Effect } from 'effect';
import { asc, eq } from 'drizzle-orm';
import { DbClientTag } from '../../../../db/db.provider';
import { paymentAttempts, type PaymentAttemptRow } from '../../../entity';
import { checkPayment } from '../transaction/check-payment.use-case';
import {
  PaymentPersistenceError,
  PaymentTransactionNotFoundError,
} from '../errors';

export interface ListOwnedPaymentAttemptsInput {
  paymentTransactionId: string;
  customerId: string;
}

type ListOwnedPaymentAttemptsError =
  | PaymentTransactionNotFoundError
  | PaymentPersistenceError;

/**
 * `GET /payments/:id/attempts`'s whole read path (owner only) — same
 * ownership-as-not-found treatment as `checkOwnedPaymentTransaction`. The
 * attempt listing (formerly its own `listPaymentAttempts` use-case) is
 * inlined here since this was its only caller.
 */
export const listOwnedPaymentAttempts = Effect.fn('listOwnedPaymentAttempts')(
  function* (
    input: ListOwnedPaymentAttemptsInput,
  ): Effect.fn.Return<
    PaymentAttemptRow[],
    ListOwnedPaymentAttemptsError,
    DbClientTag
  > {
    const transaction = yield* checkPayment(input.paymentTransactionId);
    if (transaction.customerId !== input.customerId) {
      return yield* new PaymentTransactionNotFoundError({
        id: input.paymentTransactionId,
      });
    }

    const db = yield* DbClientTag;
    return yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(paymentAttempts)
          .where(
            eq(
              paymentAttempts.paymentTransactionId,
              input.paymentTransactionId,
            ),
          )
          .orderBy(asc(paymentAttempts.attemptedAt)),
      catch: (cause) => new PaymentPersistenceError({ cause }),
    });
  },
);
