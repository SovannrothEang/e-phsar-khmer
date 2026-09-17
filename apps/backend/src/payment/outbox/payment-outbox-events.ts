/**
 * Outbox `eventType` names shared by the enqueue use-cases (producers) and
 * the outbox handlers (publishers to BullMQ). A leaf file with no imports,
 * same rationale as `../payment.constants.ts` — both sides can depend on it
 * without a module/use-case import cycle.
 *
 * The three below are internal DB→BullMQ handoff plumbing — not the
 * business-level `PAYMENT_SETTLED_OUTBOX_EVENT_TYPE` further down, which
 * announces a settled payment to the rest of the system. Same
 * `OutboxModule`, different purpose, no relation to each other.
 */
export const PAYMENT_ATTEMPT_OUTBOX_EVENT_TYPE = 'payment.attempt.requested';
export const PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE =
  'payment.provider_event.received';
/**
 * One round of "schedule the next reconcile() poll" for a provider with no
 * webhook (see `../providers/bakong/README.md`). Unlike the two events
 * above, a single attempt can produce many of these over its lifetime — one
 * per poll round — so producers deliberately omit `dedupeKey` (see
 * `OutboxService.enqueue`'s doc comment: no key means every call is a
 * distinct event, which is exactly what a repeating poll needs).
 */
export const PAYMENT_ATTEMPT_POLL_OUTBOX_EVENT_TYPE =
  'payment.attempt.poll_requested';

/**
 * A `payment_transaction` reached a terminal `succeeded` status and its
 * ledger posting committed. Written by `enqueuePaymentSettledEvent`
 * (`../use-cases/payments/enqueue-payment-settled-event.use-case.ts`) inside
 * the same DB transaction as the ledger posting itself, from all three
 * success-transition use-cases. Unlike the three DB→BullMQ events above,
 * nothing in this module registers a handler for this type — it exists for
 * other modules (notifications, orders) to subscribe to later. Until a
 * handler exists, a row of this type simply retries on the outbox's normal
 * backoff schedule and eventually lands as `failed` once it exhausts
 * `maxAttempts` — expected and harmless (see `OutboxDispatcher.run`'s doc
 * comment: "producer can be live before its consumer"), not data loss: the
 * row stays in `outbox_events` for a future handler or manual replay.
 */
export const PAYMENT_SETTLED_OUTBOX_EVENT_TYPE = 'payment.succeeded';
