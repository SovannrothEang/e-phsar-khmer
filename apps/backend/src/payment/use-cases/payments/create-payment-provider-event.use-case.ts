import { Effect } from 'effect';
import { and, eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import {
  paymentProviderEvents,
  type PaymentProviderEventRow,
} from '../../entity';
import { PaymentPersistenceError } from './errors';

export interface CreatePaymentProviderEventInput {
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: unknown;
  paymentAttemptId?: string;
}

export interface CreatePaymentProviderEventResult {
  event: PaymentProviderEventRow;
  /** false when this exact (provider, providerEventId) pair was already received. */
  isNew: boolean;
}

type CreatePaymentProviderEventError = PaymentPersistenceError;

/**
 * Webhook intake: inserts a payment_provider_event, deduped on
 * (provider, providerEventId). A duplicate delivery is structural
 * idempotency, not an error — this returns the existing row with
 * `isNew: false` instead of failing, so a retried webhook is a safe no-op.
 */
export const createPaymentProviderEvent = Effect.fn(
  'createPaymentProviderEvent',
)(function* (
  input: CreatePaymentProviderEventInput,
): Effect.fn.Return<
  CreatePaymentProviderEventResult,
  CreatePaymentProviderEventError,
  DbClientTag
> {
  const db = yield* DbClientTag;
  const insertedRows = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(paymentProviderEvents)
        .values({
          paymentAttemptId: input.paymentAttemptId ?? null,
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          payload: input.payload,
        })
        .onConflictDoNothing({
          target: [
            paymentProviderEvents.provider,
            paymentProviderEvents.providerEventId,
          ],
        })
        .returning(),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  const [insertedRow] = insertedRows;
  if (insertedRow) {
    return { event: insertedRow, isNew: true };
  }

  const existingRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(paymentProviderEvents)
        .where(
          and(
            eq(paymentProviderEvents.provider, input.provider),
            eq(paymentProviderEvents.providerEventId, input.providerEventId),
          ),
        ),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });
  const [existingRow] = existingRows;
  return { event: existingRow, isNew: false };
});
