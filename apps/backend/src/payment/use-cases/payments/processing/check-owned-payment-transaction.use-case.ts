import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag } from '../../../../db/db.provider';
import {
  paymentTransactionDetails,
  type PaymentTransactionRow,
} from '../../../entity';
import { checkPayment } from '../transaction/check-payment.use-case';
import {
  PaymentPersistenceError,
  PaymentTransactionNotFoundError,
} from '../errors';

export interface CheckOwnedPaymentTransactionInput {
  id: string;
  customerId: string;
}

export interface CheckOwnedPaymentTransactionResult extends PaymentTransactionRow {
  checkout: {
    providerTransactionId: string | null;
    paymentMethodType: string | null;
    maskedAccount: string | null;
    redirectUrl: string | null;
    rawResponse: unknown;
  } | null;
}

type CheckOwnedPaymentTransactionError =
  | PaymentTransactionNotFoundError
  | PaymentPersistenceError;

/**
 * `GET /payments/:id`'s whole read path (owner only). Failing with
 * `PaymentTransactionNotFoundError` on an ownership mismatch — the exact
 * same error `checkPayment` fails with for a nonexistent id — is
 * deliberate: `toHttpException` maps both to the same 404, so a caller can
 * never distinguish "doesn't exist" from "exists but isn't yours."
 *
 * The `payment_transaction_details` lookup (formerly its own
 * `findPaymentTransactionDetail` use-case) is inlined here since this was
 * its only caller. `checkout` stays `null` rather than erroring on a brand
 * new transaction — right after `POST /payments`, `charge()` hasn't run
 * yet (it's dispatched async via the outbox), so there is legitimately no
 * detail row for a client that polls this immediately after creating one.
 */
export const checkOwnedPaymentTransaction = Effect.fn(
  'checkOwnedPaymentTransaction',
)(function* (
  input: CheckOwnedPaymentTransactionInput,
): Effect.fn.Return<
  CheckOwnedPaymentTransactionResult,
  CheckOwnedPaymentTransactionError,
  DbClientTag
> {
  const transaction = yield* checkPayment(input.id);
  if (transaction.customerId !== input.customerId) {
    return yield* new PaymentTransactionNotFoundError({ id: input.id });
  }

  const db = yield* DbClientTag;
  const detailRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(paymentTransactionDetails)
        .where(eq(paymentTransactionDetails.paymentTransactionId, input.id))
        .limit(1),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });
  const detail = detailRows[0];

  return {
    ...transaction,
    checkout: detail
      ? {
          providerTransactionId: detail.providerTransactionId,
          paymentMethodType: detail.paymentMethodType,
          maskedAccount: detail.maskedAccount,
          redirectUrl: detail.redirectUrl,
          rawResponse: detail.rawResponse,
        }
      : null,
  };
});
