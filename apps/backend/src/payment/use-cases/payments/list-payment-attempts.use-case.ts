import { Effect } from 'effect';
import { asc, eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import { paymentAttempts, type PaymentAttemptRow } from '../../entity';
import { PaymentPersistenceError } from './errors';

export interface ListPaymentAttemptsInput {
  paymentTransactionId: string;
}

type ListPaymentAttemptsError = PaymentPersistenceError;

/**
 * All attempts under one payment_transaction, oldest first — the "why is
 * this transaction still pending" audit trail. Returns [] for an unknown
 * transaction id rather than a not-found error, matching this backend's
 * convention for list endpoints (see locations/brands).
 */
export const listPaymentAttempts = Effect.fn('listPaymentAttempts')(function* (
  input: ListPaymentAttemptsInput,
): Effect.fn.Return<
  PaymentAttemptRow[],
  ListPaymentAttemptsError,
  DbClientTag
> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(paymentAttempts)
        .where(
          eq(paymentAttempts.paymentTransactionId, input.paymentTransactionId),
        )
        .orderBy(asc(paymentAttempts.attemptedAt)),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });
  return rows;
});
