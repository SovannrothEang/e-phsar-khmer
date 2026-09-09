/**
 * Job names and payloads for the `payments` BullMQ queue. Two distinct
 * lifecycle steps share one queue: dispatching a payment_attempt against a
 * provider, and processing an already-received payment_provider_event.
 * Consumed by `PaymentProcessor` (`../processors/payment.processor.ts`).
 */

export const PAYMENT_ATTEMPT_JOB = 'process-attempt';
export const PAYMENT_EVENT_JOB = 'process-provider-event';

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

export type PaymentJobData =
  | ProcessAttemptJobData
  | ProcessProviderEventJobData;
