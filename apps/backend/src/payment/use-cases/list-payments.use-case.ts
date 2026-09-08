import { Effect } from 'effect';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { DbClientTag } from '../../db/db.provider';
import {
  paymentTransactions,
  paymentTransactionStatusEnum,
  type PaymentTransactionRow,
} from '../entity/payment-transaction';
import { PaymentPersistenceError } from './errors';

export interface ListPaymentsInput {
  customerId?: string;
  status?: (typeof paymentTransactionStatusEnum.enumValues)[number];
  limit?: number;
  offset?: number;
}

export interface ListPaymentsResult {
  items: PaymentTransactionRow[];
  limit: number;
  offset: number;
}

type ListPaymentsError = PaymentPersistenceError;

/**
 * Offset-paginated read of payment_transactions, optionally filtered by
 * customer and/or status. No cursor pagination here (unlike the listings
 * feed) — this is an admin/owner lookup, not a public high-volume feed.
 */
export const listPayments = Effect.fn('listPayments')(function* (
  input: ListPaymentsInput = {},
): Effect.fn.Return<ListPaymentsResult, ListPaymentsError, DbClientTag> {
  const db = yield* DbClientTag;
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  const conditions: SQL[] = [];
  if (input.customerId !== undefined) {
    conditions.push(eq(paymentTransactions.customerId, input.customerId));
  }
  if (input.status !== undefined) {
    conditions.push(eq(paymentTransactions.status, input.status));
  }

  const items = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(paymentTransactions)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(paymentTransactions.createdAt))
        .limit(limit)
        .offset(offset),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  return { items, limit, offset };
});
