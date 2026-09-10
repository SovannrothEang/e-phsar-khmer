import { Effect } from 'effect';
import { DbClientTag } from '../../../db/db.provider';
import {
  paymentTransactions,
  paymentTransactionTypeEnum,
  type PaymentTransactionRow,
} from '../../entity';
import {
  DuplicateIdempotencyKeyError,
  PaymentPersistenceError,
} from './errors';

export interface CreatePaymentInput {
  tenantId: string;
  reference: string;
  idempotencyKey?: string;
  amount: string;
  currency: string;
  type: (typeof paymentTransactionTypeEnum.enumValues)[number];
  customerId?: string;
  orderId?: string;
  description?: string;
  expiresAt?: Date;
}

type CreatePaymentError =
  | DuplicateIdempotencyKeyError
  | PaymentPersistenceError;

function toCreatePaymentError(
  cause: unknown,
  idempotencyKey: string | undefined,
): CreatePaymentError {
  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause
      ? (cause as { code?: string }).code
      : undefined;
  if (code === '23505' && idempotencyKey) {
    return new DuplicateIdempotencyKeyError({ idempotencyKey });
  }
  return new PaymentPersistenceError({ cause });
}

/**
 * Inserts a new payment_transaction row (status defaults to `pending`).
 * This is the only place a payment_transaction is ever created — everything
 * else in the lifecycle updates a row this produced.
 */
export const createPayment = Effect.fn('createPayment')(function* (
  input: CreatePaymentInput,
): Effect.fn.Return<PaymentTransactionRow, CreatePaymentError, DbClientTag> {
  const db = yield* DbClientTag;
  const rows = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(paymentTransactions)
        .values({
          tenantId: input.tenantId,
          reference: input.reference,
          idempotencyKey: input.idempotencyKey ?? null,
          amount: input.amount,
          currency: input.currency,
          type: input.type,
          customerId: input.customerId ?? null,
          orderId: input.orderId ?? null,
          description: input.description ?? null,
          expiresAt: input.expiresAt ?? null,
        })
        .returning(),
    catch: (cause) => toCreatePaymentError(cause, input.idempotencyKey),
  });
  const [row] = rows;
  return row;
});
