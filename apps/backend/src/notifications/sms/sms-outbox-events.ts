/**
 * Outbox `eventType` for an opt-in SMS send. Leaf file, no imports, so the
 * producer (`NotificationsService.notify()`) and the consumer
 * (`SmsOutboxHandler`) can both depend on it without a cycle — the same
 * convention as `payment/outbox/payment-outbox-events.ts`.
 */
export const SMS_REQUESTED_OUTBOX_EVENT_TYPE = 'notification.sms.requested';

/**
 * Attempts the outbox budgets this event type before giving up and calling
 * `onAbandoned`.
 *
 * Higher than the global default (5) on purpose: `attempts` is incremented
 * at *claim* time (see `OutboxService.claim`), so an over-budget rate-limit
 * `retry` burns an attempt exactly like a transient network failure would.
 * PlasGate's own ceiling is 150 requests/minute here (`SmsRateLimiter`), and
 * a burst can legitimately need several retries before a slot frees up. The
 * outbox's exponential backoff (`OUTBOX_BACKOFF_BASE_MS` × `FACTOR^n`,
 * default 1s × 5^n) grows fast — by the 4th attempt it is already minutes —
 * so this budget exists to absorb rate-limit retries while they are still
 * cheap (the first few, seconds-scale) rather than to survive deep into
 * the backoff curve. A permanently bad sender id or phone number still
 * fails fast via the handler's own `failed` outcome, never retried.
 */
export const SMS_REQUESTED_MAX_ATTEMPTS = 20;
