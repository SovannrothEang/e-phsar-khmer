import type {
  paymentAttemptMethodEnum,
  paymentAttemptStatusEnum,
} from '../entity/payment-attempt';

export type PaymentAttemptMethod =
  (typeof paymentAttemptMethodEnum.enumValues)[number];
export type PaymentAttemptOutcome =
  (typeof paymentAttemptStatusEnum.enumValues)[number];

/**
 * What PaymentProcessorService hands a provider to start a charge. Mirrors
 * the payment_attempts row already inserted (pending) before the provider
 * call is made — a provider never creates its own attempt record, it only
 * reports back what happened to this one.
 */
export interface ChargeRequest {
  attemptId: string;
  transactionId: string;
  reference: string;
  amount: string;
  currency: string;
  method: PaymentAttemptMethod;
  customerId?: string;
  description?: string;
  returnUrl?: string;
}

/**
 * What a provider hands back after a charge call. `rawResponse` is the
 * provider's own response shape, unredacted — callers must run it through
 * `PaymentGatewayProvider.redact()` before it touches
 * payment_transaction_details.rawResponse.
 */
export interface ChargeResult {
  status: PaymentAttemptOutcome;
  providerAttemptId?: string;
  providerTransactionId?: string;
  paymentMethodType?: string;
  maskedAccount?: string;
  redirectUrl?: string;
  failureCode?: string;
  failureMessage?: string;
  rawResponse: unknown;
}

export interface WebhookVerification {
  valid: boolean;
  reason?: string;
}

/**
 * A webhook body normalized into the shape payment_provider_events and the
 * status-transition logic need. `payload` is unredacted raw JSON — same
 * redact-before-persist rule as ChargeResult.rawResponse applies here.
 */
export interface ParsedProviderEvent {
  providerEventId: string;
  eventType: string;
  providerAttemptId?: string;
  status: PaymentAttemptOutcome | 'unknown';
  failureCode?: string;
  failureMessage?: string;
  payload: unknown;
}
