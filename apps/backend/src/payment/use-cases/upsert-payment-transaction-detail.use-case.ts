import { Effect } from 'effect';
import {
  paymentTransactionDetails,
  type PaymentTransactionDetailRow,
} from '../entity/payment-transaction-detail';
import { DbClientTag } from '../../db/db.provider';
import { PaymentPersistenceError } from './errors';

export interface UpsertPaymentTransactionDetailInput {
  paymentTransactionId: string;
  provider: string;
  providerTransactionId?: string;
  paymentMethodType?: string;
  maskedAccount?: string;
  redirectUrl?: string;
  rawResponse?: unknown;
}

type UpsertPaymentTransactionDetailError = PaymentPersistenceError;

/**
 * Insert-or-update the 1:1 satellite row for a payment_transaction. One
 * gateway call can be followed by another (a retried attempt, a reconcile
 * corroboration) that learns more — this always overwrites with the latest
 * known state rather than only ever inserting once.
 */
export const upsertPaymentTransactionDetail = Effect.fn(
  'upsertPaymentTransactionDetail',
)(function* (
  input: UpsertPaymentTransactionDetailInput,
): Effect.fn.Return<
  PaymentTransactionDetailRow,
  UpsertPaymentTransactionDetailError,
  DbClientTag
> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(paymentTransactionDetails)
        .values({
          paymentTransactionId: input.paymentTransactionId,
          provider: input.provider,
          providerTransactionId: input.providerTransactionId ?? null,
          paymentMethodType: input.paymentMethodType ?? null,
          maskedAccount: input.maskedAccount ?? null,
          redirectUrl: input.redirectUrl ?? null,
          rawResponse: input.rawResponse ?? null,
        })
        .onConflictDoUpdate({
          target: paymentTransactionDetails.paymentTransactionId,
          set: {
            provider: input.provider,
            providerTransactionId: input.providerTransactionId ?? null,
            paymentMethodType: input.paymentMethodType ?? null,
            maskedAccount: input.maskedAccount ?? null,
            redirectUrl: input.redirectUrl ?? null,
            rawResponse: input.rawResponse ?? null,
            updatedAt: new Date(),
          },
        })
        .returning(),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });
  const [row] = rows;
  return row;
});
