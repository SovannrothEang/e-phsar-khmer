import { Schema } from 'effect';
import { LedgerImbalanceError } from '../ledgers';

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

/**
 * The durable handoff to the `payments` BullMQ queue failed — specifically,
 * writing the `outbox_events` row that a `payment.attempt.requested` /
 * `payment.provider_event.received` handler later publishes to BullMQ (see
 * `payment/outbox/*`). Named for the queue rather than the outbox because
 * that's the caller-visible effect: this payment won't be processed.
 */
export class PaymentQueueError extends Schema.TaggedError<PaymentQueueError>()(
  'PaymentQueueError',
  { cause: Schema.Defect() },
) {}

export type PaymentUseCaseError =
  | PaymentTransactionNotFoundError
  | DuplicateIdempotencyKeyError
  | PaymentTransactionConflictError
  | PaymentPersistenceError
  | PaymentQueueError;

/**
 * Failures specific to the BullMQ processor's own use-cases
 * (`process-payment-attempt`, `process-provider-event`). Kept out of
 * `PaymentUseCaseError` deliberately: nothing in `PaymentsController` ever
 * produces these, so `toHttpException` never needs to know about them —
 * the processor throws on them directly to ask BullMQ for a retry.
 */
export class PaymentAttemptNotFoundError extends Schema.TaggedError<PaymentAttemptNotFoundError>()(
  'PaymentAttemptNotFoundError',
  { id: Schema.String },
) {}

export class PaymentProviderEventNotFoundError extends Schema.TaggedError<PaymentProviderEventNotFoundError>()(
  'PaymentProviderEventNotFoundError',
  { id: Schema.String },
) {}

/**
 * `PaymentGatewayRegistry.resolve()` found nothing for the attempt's
 * `provider` string — a wiring mistake (typo, a provider never
 * registered), not a transient fault. Never retried: the attempt is
 * failed outright rather than burning the job's retry budget on something
 * a retry can't fix.
 */
export class PaymentGatewayNotRegisteredError extends Schema.TaggedError<PaymentGatewayNotRegisteredError>()(
  'PaymentGatewayNotRegisteredError',
  { provider: Schema.String },
) {}

/**
 * The gateway call itself failed to produce an answer (network error,
 * timeout, non-2xx from the provider) — as opposed to the provider
 * answering with an explicit rejection, which is a normal `ChargeResult`,
 * not an error. Always thrown up to BullMQ for retry: the outcome is
 * unknown, not negative.
 */
export class PaymentGatewayCallError extends Schema.TaggedError<PaymentGatewayCallError>()(
  'PaymentGatewayCallError',
  { cause: Schema.Defect() },
) {}

export type PaymentProcessingError =
  | PaymentAttemptNotFoundError
  | PaymentTransactionNotFoundError
  | PaymentProviderEventNotFoundError
  | PaymentGatewayNotRegisteredError
  | PaymentGatewayCallError
  | PaymentTransactionConflictError
  | PaymentPersistenceError
  // Scheduling the next reconcile() poll (see poll-payment-attempt.use-case.ts)
  // writes an outbox row like any other durable handoff in this module —
  // this is that write failing, thrown up to ask BullMQ to retry the job.
  | PaymentQueueError
  // A settled payment's ledger posting failed to balance — see
  // post-payment-settlement-ledger.use-case.ts.
  | LedgerImbalanceError;
