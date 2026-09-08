import { Schema } from 'effect';

/**
 * Typed failures for the payment_transaction use-cases. Each use-case's
 * signature lists exactly which of these it can fail with — callers see the
 * failure modes at the type level instead of discovering them from a thrown
 * exception at runtime.
 */

export class PaymentTransactionNotFoundError extends Schema.TaggedError<PaymentTransactionNotFoundError>()(
  'PaymentTransactionNotFoundError',
  { id: Schema.String },
) {}

export class DuplicateIdempotencyKeyError extends Schema.TaggedError<DuplicateIdempotencyKeyError>()(
  'DuplicateIdempotencyKeyError',
  { idempotencyKey: Schema.String },
) {}

/**
 * The row's `version` no longer matches `expectedVersion` — someone else
 * (a webhook, a concurrent status update) won the race. The caller should
 * re-read and retry, not blindly overwrite.
 */
export class PaymentTransactionConflictError extends Schema.TaggedError<PaymentTransactionConflictError>()(
  'PaymentTransactionConflictError',
  { id: Schema.String, expectedVersion: Schema.Number },
) {}

/** Catch-all for a DB failure that isn't one of the above — connection drop, syntax error, etc. */
export class PaymentPersistenceError extends Schema.TaggedError<PaymentPersistenceError>()(
  'PaymentPersistenceError',
  { cause: Schema.Defect() },
) {}

export type PaymentUseCaseError =
  | PaymentTransactionNotFoundError
  | DuplicateIdempotencyKeyError
  | PaymentTransactionConflictError
  | PaymentPersistenceError;
