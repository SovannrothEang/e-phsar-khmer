import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import {
  paymentTransactionDetails,
  type PaymentTransactionDetailRow,
} from '../../entity';
import { PaymentPersistenceError } from './errors';

type FindPaymentTransactionDetailError = PaymentPersistenceError;

/**
 * The checkout artifact a gateway call produced — QR string, redirect URL,
 * masked account, raw response — keyed 1:1 on `payment_transaction_id`.
 * Returns `undefined` rather than failing when nothing exists yet: right
 * after `POST /payments`, `charge()` hasn't run (it's dispatched async via
 * the outbox — see `../README.md`), so there is legitimately no detail row
 * for a brand new transaction. A client polling `GET /payments/:id` right
 * after creating one is expected to see `undefined` at first and the real
 * payload a poll or two later, not an error.
 */
export const findPaymentTransactionDetail = Effect.fn(
  'findPaymentTransactionDetail',
)(function* (
  paymentTransactionId: string,
): Effect.fn.Return<
  PaymentTransactionDetailRow | undefined,
  FindPaymentTransactionDetailError,
  DbClientTag
> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(paymentTransactionDetails)
        .where(
          eq(
            paymentTransactionDetails.paymentTransactionId,
            paymentTransactionId,
          ),
        )
        .limit(1),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  return rows[0];
});
