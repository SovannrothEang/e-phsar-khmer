import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import { paymentAttempts, type PaymentAttemptRow } from '../../entity';
import { PaymentAttemptNotFoundError, PaymentPersistenceError } from './errors';

type FindPaymentAttemptError =
  | PaymentAttemptNotFoundError
  | PaymentPersistenceError;

/** Reads a single payment_attempt by id, or fails if it doesn't exist. */
export const findPaymentAttempt = Effect.fn('findPaymentAttempt')(function* (
  id: string,
): Effect.fn.Return<PaymentAttemptRow, FindPaymentAttemptError, DbClientTag> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db.select().from(paymentAttempts).where(eq(paymentAttempts.id, id)),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  const [row] = rows;
  if (!row) {
    return yield* new PaymentAttemptNotFoundError({ id });
  }
  return row;
});
