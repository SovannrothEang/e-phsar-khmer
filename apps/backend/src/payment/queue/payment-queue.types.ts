/**
 * Job names and payloads for the `payments` BullMQ queue. Three distinct
 * lifecycle steps share one queue: dispatching a payment_attempt against a
 * provider, processing an already-received payment_provider_event, and
 * (for a provider with no webhook at all — see
 * `../providers/bakong/README.md`) re-checking one that's still pending.
 * Consumed by `PaymentProcessor` (`../processors/payment.processor.ts`).
 */

export const PAYMENT_ATTEMPT_JOB = 'process-attempt';
export const PAYMENT_EVENT_JOB = 'process-provider-event';
export const PAYMENT_POLL_JOB = 'poll-attempt';

export interface ProcessAttemptJobData {
  paymentTransactionId: string;
  paymentAttemptId: string;
  /**
   * The payer's post-checkout browser redirect (e.g. ABA PayWay
   * `continue_success_url`) — NOT a webhook/callback target, which is
   * fixed server config (see AbaPaywayProvider.charge()), never
   * request-scoped. Carried through the outbox row and the BullMQ job
   * payload rather than a DB column — only needed for the one `charge()`
   * call this job makes.
   */
  browserReturnUrl?: string;
}

export interface ProcessProviderEventJobData {
  paymentProviderEventId: string;
}

/**
 * One round of "ask the gateway again". Carries `intervalMs`/`expiresAt`
 * rather than re-deriving them from `payment_transaction_details` each
 * round — they came from the original `ChargeResult.poll` and never change
 * for the life of one attempt, so there's nothing to re-read.
 */
export interface PollAttemptJobData {
  paymentTransactionId: string;
  paymentAttemptId: string;
  intervalMs: number;
  expiresAt: number;
}

export type PaymentJobData =
  | ProcessAttemptJobData
  | ProcessProviderEventJobData
  | PollAttemptJobData;
