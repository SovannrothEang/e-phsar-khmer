import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import {
  paymentProviderEvents,
  paymentProviderEventStatusEnum,
  type PaymentProviderEventRow,
} from '../../entity';
import { PaymentPersistenceError } from './errors';

export interface SettlePaymentProviderEventInput {
  id: string;
  status: Extract<
    (typeof paymentProviderEventStatusEnum.enumValues)[number],
    'processed' | 'ignored' | 'failed'
  >;
}

type SettlePaymentProviderEventError = PaymentPersistenceError;

/**
 * Marks a payment_provider_event terminal. `ignored` covers both an event
 * that couldn't be correlated to any attempt and a late/duplicate
 * notification that arrived after the transaction was already terminal —
 * either way there's nothing further to do with it.
 */
export const settlePaymentProviderEvent = Effect.fn(
  'settlePaymentProviderEvent',
)(function* (
  input: SettlePaymentProviderEventInput,
): Effect.fn.Return<
  PaymentProviderEventRow,
  SettlePaymentProviderEventError,
  DbClientTag
> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .update(paymentProviderEvents)
        .set({ status: input.status, processedAt: new Date() })
        .where(eq(paymentProviderEvents.id, input.id))
        .returning(),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });
  const [row] = rows;
  return row;
});
