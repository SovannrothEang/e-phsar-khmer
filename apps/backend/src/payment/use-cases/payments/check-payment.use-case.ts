import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import { paymentTransactions, type PaymentTransactionRow } from '../../entity';
import {
  PaymentPersistenceError,
  PaymentTransactionNotFoundError,
} from './errors';

type CheckPaymentError =
  | PaymentTransactionNotFoundError
  | PaymentPersistenceError;

/**
 * Reads a single payment_transaction by id — "check where this payment
 * currently stands." Fails with PaymentTransactionNotFoundError rather than
 * returning null, so a caller can't forget to handle the missing case.
 */
export const checkPayment = Effect.fn('checkPayment')(function* (
  id: string,
): Effect.fn.Return<PaymentTransactionRow, CheckPaymentError, DbClientTag> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.id, id)),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  const [row] = rows;
  if (!row) {
    return yield* new PaymentTransactionNotFoundError({ id });
  }
  return row;
});
