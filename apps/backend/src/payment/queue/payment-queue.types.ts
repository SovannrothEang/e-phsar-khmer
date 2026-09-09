/**
 * Job names and payloads for the `payments` BullMQ queue. Two distinct
 * lifecycle steps share one queue: dispatching a payment_attempt against a
 * provider, and processing an already-received payment_provider_event.
 * Neither has a processor/consumer yet — these are the producer-side
 * contracts a future `@Processor(PAYMENT_QUEUE)` class will consume.
 */

export const PAYMENT_ATTEMPT_JOB = 'process-attempt';
export const PAYMENT_EVENT_JOB = 'process-provider-event';

export interface ProcessAttemptJobData {
  paymentTransactionId: string;
  paymentAttemptId: string;
}

export interface ProcessProviderEventJobData {
  paymentProviderEventId: string;
}

export type PaymentJobData =
  | ProcessAttemptJobData
  | ProcessProviderEventJobData;
