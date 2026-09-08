import type {
  ChargeRequest,
  ChargeResult,
  ParsedProviderEvent,
  WebhookVerification,
} from './payment-gateway.types';

/**
 * One implementation per bank/gateway (ABA PayWay, Wing, ACLEDA, ...). The
 * `name` must match the plain `provider` text column already stored on
 * payment_attempts / payment_transaction_details / payment_provider_events —
 * PaymentGatewayRegistry resolves on it, so it's the provider's own identity,
 * not a display label.
 */
export interface PaymentGatewayProvider {
  readonly name: string;

  charge(request: ChargeRequest): Promise<ChargeResult>;

  verifyWebhookSignature(
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ): WebhookVerification;

  parseWebhookEvent(
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ): ParsedProviderEvent;

  /**
   * Strips whatever this provider's raw payloads carry that shouldn't sit in
   * Postgres verbatim (full PAN, bank account numbers, auth tokens) before
   * the caller persists rawResponse / payload as jsonb. Redaction is
   * provider-specific because each gateway's response shape is different —
   * there is no generic scrubber that knows every provider's field names.
   */
  redact(payload: unknown): unknown;
}

export const PAYMENT_GATEWAY_PROVIDERS = Symbol('PAYMENT_GATEWAY_PROVIDERS');
