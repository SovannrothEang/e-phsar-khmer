/**
 * Outbox `eventType` names shared by the enqueue use-cases (producers) and
 * the outbox handlers (publishers to BullMQ). A leaf file with no imports,
 * same rationale as `../payment.constants.ts` — both sides can depend on it
 * without a module/use-case import cycle.
 *
 * These are internal DB→BullMQ handoff plumbing, not the business-level
 * `payment.succeeded`/`payment.refunded` integration events a future ledger
 * step would publish for other modules to subscribe to — same
 * `OutboxModule`, different event types, no relation to each other.
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
