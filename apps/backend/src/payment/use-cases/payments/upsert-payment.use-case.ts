import { Effect } from 'effect';
import { and, eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import {
  paymentTransactions,
  paymentTransactionStatusEnum,
  type PaymentTransactionRow,
} from '../../entity';
import {
  PaymentPersistenceError,
  PaymentTransactionConflictError,
  PaymentTransactionNotFoundError,
} from './errors';

export interface UpsertPaymentInput {
  id: string;
  expectedVersion: number;
  status?: (typeof paymentTransactionStatusEnum.enumValues)[number];
  description?: string;
  completedAt?: Date;
  expiresAt?: Date | null;
}

type UpsertPaymentError =
  | PaymentTransactionNotFoundError
  | PaymentTransactionConflictError
  | PaymentPersistenceError;

/**
 * Updates a payment_transaction in place. There's no real insert branch —
 * a payment_transaction only ever comes from createPayment — so "upsert"
 * here means "update, guarded by optimistic locking on `version`": the row
 * must currently be at `expectedVersion`, or this fails with a conflict
 * instead of silently clobbering a racing webhook/poll update.
 */
export const upsertPayment = Effect.fn('upsertPayment')(function* (
  input: UpsertPaymentInput,
): Effect.fn.Return<PaymentTransactionRow, UpsertPaymentError, DbClientTag> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .update(paymentTransactions)
        .set({
          version: input.expectedVersion + 1,
          updatedAt: new Date(),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.completedAt !== undefined
            ? { completedAt: input.completedAt }
            : {}),
          ...(input.expiresAt !== undefined
            ? { expiresAt: input.expiresAt }
            : {}),
        })
        .where(
          and(
            eq(paymentTransactions.id, input.id),
            eq(paymentTransactions.version, input.expectedVersion),
          ),
        )
        .returning(),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  const [row] = rows;
  if (row) {
    return row;
  }

  // Nothing matched — either the id doesn't exist, or the version was stale.
  // A follow-up read disambiguates so the caller gets the right error
  // instead of "not found" either way.
  const existingRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ id: paymentTransactions.id })
        .from(paymentTransactions)
        .where(eq(paymentTransactions.id, input.id)),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  if (!existingRows[0]) {
    return yield* new PaymentTransactionNotFoundError({ id: input.id });
  }
  return yield* new PaymentTransactionConflictError({
    id: input.id,
    expectedVersion: input.expectedVersion,
  });
});
