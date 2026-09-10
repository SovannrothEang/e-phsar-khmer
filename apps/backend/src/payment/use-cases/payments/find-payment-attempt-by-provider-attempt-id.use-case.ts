import { Effect } from 'effect';
import { and, desc, eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import { paymentAttempts, type PaymentAttemptRow } from '../../entity';
import { PaymentPersistenceError } from './errors';

export interface FindPaymentAttemptByProviderAttemptIdInput {
  provider: string;
  providerAttemptId: string;
}

type FindPaymentAttemptByProviderAttemptIdError = PaymentPersistenceError;

/**
 * Correlates an inbound webhook back to the attempt it's about, via the
 * `(provider, providerAttemptId)` index — `providerAttemptId` is set on
 * `charge()`'s response and echoed back by the gateway on every subsequent
 * call. Returns `undefined` rather than failing when nothing matches: an
 * uncorrelated webhook (unknown reference, or a malformed/spoofed POST) is
 * an expected case the caller handles, not an error.
 */
export const findPaymentAttemptByProviderAttemptId = Effect.fn(
  'findPaymentAttemptByProviderAttemptId',
)(function* (
  input: FindPaymentAttemptByProviderAttemptIdInput,
): Effect.fn.Return<
  PaymentAttemptRow | undefined,
  FindPaymentAttemptByProviderAttemptIdError,
  DbClientTag
> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(paymentAttempts)
        .where(
          and(
            eq(paymentAttempts.provider, input.provider),
            eq(paymentAttempts.providerAttemptId, input.providerAttemptId),
          ),
        )
        .orderBy(desc(paymentAttempts.attemptedAt))
        .limit(1),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  return rows[0];
});
