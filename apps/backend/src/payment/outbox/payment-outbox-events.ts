/**
 * Outbox `eventType` names shared by the enqueue use-cases and their
 * handlers. Leaf file, no imports, so both sides can depend on it without a
 * cycle. The first two are internal DB→BullMQ handoff plumbing, distinct
 * from the business-level `PAYMENT_SETTLED_OUTBOX_EVENT_TYPE` below.
 */
export const PAYMENT_ATTEMPT_OUTBOX_EVENT_TYPE = 'payment.attempt.requested';
export const PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE =
  'payment.provider_event.received';
/**
 * One round of "schedule the next reconcile() poll" for a provider with no
 * webhook (see `../providers/bakong/README.md`). Deliberately omits
 * `dedupeKey` — a single attempt produces many of these over its lifetime.
 */
export const PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE =
  'payment.attempt.poll_requested';

/**
 * A `payment_transaction` reached terminal `succeeded` and its ledger
 * posting committed. Written by `enqueuePaymentSettledEvent` inside the
 * same DB transaction as the ledger posting, from all three
 * success-transition use-cases. Consumed by `PaymentSettledOutboxHandler`.
 */
export const PAYMENT_SETTLED_OUTBOX_EVENT_TYPE = 'payment.succeeded';
