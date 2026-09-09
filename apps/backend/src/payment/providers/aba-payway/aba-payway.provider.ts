import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ChargeRequest,
  ChargeResult,
  ParsedProviderEvent,
  WebhookVerification,
} from '../payment-gateway.types';
import type { PaymentGatewayProvider } from '../payment-gateway.interface';
import { base64EncodeAbaPaywayUrl } from './aba-payway.encoding';
import {
  signAbaPayway,
  verifyAbaPaywayCallbackSignature,
} from './aba-payway.signing';
import {
  ABA_PAYWAY_API_OK,
  toPaymentAttemptOutcome,
} from './aba-payway.status';
import type {
  AbaPaywayWebhookPayload,
  CheckTransactionResponse,
  CreatePurchaseResponse,
} from './aba-payway.types';

const PURCHASE_PATH = 'api/payment-gateway/v1/payments/purchase';
const CHECK_TRANSACTION_PATH =
  'api/payment-gateway/v1/payments/check-transaction-2';
// Node/NestJS lowercase incoming header names regardless of how ABA sends
// `X-PayWay-Hmac-Sha512` on the wire.
const SIGNATURE_HEADER = 'x-payway-hmac-sha512';

/**
 * ABA PayWay's implementation of the gateway seam. The only place that
 * knows PayWay's wire format: the request signature, `status.code`'s
 * meaning, and which response fields become the checkout artifact.
 *
 * `tran_id` sent to ABA is always the `payment_transactions.id` UUID (the
 * `ChargeRequest.transactionId` field), never the free-text `reference` —
 * `reference` carries no uniqueness constraint in this schema, `id` does,
 * and ABA echoes `tran_id` back verbatim on every subsequent call
 * (check-transaction, the callback body's own `tran_id`), which is what
 * lets a webhook or a reconcile lookup correlate back to the right attempt
 * without a second, ABA-specific reference field on our own tables.
 *
 * **`return_url` vs `continue_success_url`/`cancel_url` — do not conflate
 * these.** Despite the name, ABA's `return_url` is a *server-to-server*
 * field: the URL ABA POSTs the payment result to once the payer completes
 * (or abandons) checkout — functionally a per-request webhook target, not
 * a browser redirect. It is always `webhookUrl()` (fixed server config,
 * `ABA_PAYWAY_WEBHOOK_URL`, pointed at `AbaPaywayController`'s own route)
 * and is never sourced from caller input — a client controlling where
 * ABA's payment-result notification goes would be a real vulnerability.
 * `continue_success_url`/`cancel_url` are the actual browser redirects,
 * and those *are* legitimately caller-supplied, via `ChargeRequest.returnUrl`.
 * Both are base64-encoded before being sent — confirmed against ABA's own
 * documented field description for `return_url` ("URL to receive
 * callbacks upon payment completion, encrypted with Base64"); see
 * `aba-payway.encoding.ts`.
 */
@Injectable()
export class AbaPaywayProvider implements PaymentGatewayProvider {
  readonly name = 'aba_payway';

  private readonly logger = new Logger(AbaPaywayProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const webhookUrl = this.webhookUrl();
    if (!webhookUrl) {
      throw new Error(
        'ABA PayWay is not configured — set ABA_PAYWAY_WEBHOOK_URL (the ' +
          'server-to-server return_url ABA needs to report a payment ' +
          'outcome; without it a purchase would have nowhere to notify)',
      );
    }

    const reqTime = String(Date.now());
    const merchantId = this.merchantId();
    const amount = Number(request.amount);
    const currency = request.currency;

    const hash = signAbaPayway(
      [reqTime, merchantId, request.transactionId, amount, currency],
      this.apiKey(),
    );

    const response = await this.post<CreatePurchaseResponse>(PURCHASE_PATH, {
      req_time: reqTime,
      merchant_id: merchantId,
      tran_id: request.transactionId,
      amount,
      currency,
      // Server-to-server payment-result callback — fixed server config,
      // never derived from caller input (see webhookUrl()'s guard above
      // and this class's own doc comment on `return_url`). ABA's docs
      // require this value base64-encoded (see aba-payway.encoding.ts).
      return_url: base64EncodeAbaPaywayUrl(webhookUrl),
      // `request.returnUrl` is the generic browser-redirect concept from
      // ChargeRequest — maps to ABA's *browser* redirect field, a
      // different field from `return_url` above despite the similar name.
      // Base64-encoded on the same assumption as return_url (confirmed
      // for return_url specifically, inferred here — not independently
      // verified against ABA's docs for this field).
      continue_success_url: request.returnUrl
        ? base64EncodeAbaPaywayUrl(request.returnUrl)
        : undefined,
      hash,
    });

    if (response.status?.code !== ABA_PAYWAY_API_OK) {
      return {
        status: 'failed',
        failureCode: response.status?.code,
        failureMessage:
          response.status?.message ??
          `ABA PayWay refused the purchase (code ${response.status?.code ?? 'unknown'})`,
        rawResponse: response,
      };
    }

    // "00" means a checkout was created, not that money has moved yet — the
    // payer still has to scan/confirm. The attempt stays `pending` until a
    // webhook or reconcile() call reports a payment outcome.
    return {
      status: 'pending',
      providerAttemptId: response.status.tran_id,
      providerTransactionId: response.status.tran_id,
      redirectUrl: response.checkout_qr_url,
      rawResponse: response,
    };
  }

  async reconcile(providerTransactionId: string): Promise<ChargeResult> {
    const reqTime = String(Date.now());
    const merchantId = this.merchantId();

    const hash = signAbaPayway(
      [reqTime, merchantId, providerTransactionId],
      this.apiKey(),
    );

    const response = await this.post<CheckTransactionResponse>(
      CHECK_TRANSACTION_PATH,
      {
        req_time: reqTime,
        merchant_id: merchantId,
        tran_id: providerTransactionId,
        hash,
      },
    );

    // A non-"00" status here means ABA has no record of this tran_id yet —
    // inconclusive, not a rejection. `pending` lets the caller decide
    // whether to keep waiting rather than treating this as a hard failure.
    if (response.data?.status?.code !== ABA_PAYWAY_API_OK) {
      return { status: 'pending', rawResponse: response };
    }

    const data = response.data;
    const status = toPaymentAttemptOutcome(
      data.payment_status_code,
      data.payment_status,
    );

    return {
      status,
      providerTransactionId: data.status?.tran_id ?? providerTransactionId,
      failureCode:
        status === 'failed' ? String(data.payment_status_code) : undefined,
      failureMessage:
        status === 'failed' ? (data.payment_status ?? undefined) : undefined,
      rawResponse: response,
    };
  }

  /**
   * ABA PayWay signs its callback: HMAC-SHA512 over the payload (sorted
   * keys, values concatenated), keyed by the merchant API key, sent as the
   * `X-PayWay-Hmac-Sha512` header — confirmed against ABA's own
   * documentation ("Verify Callback Signature"). See
   * `signAbaPaywayCallback`/`verifyAbaPaywayCallbackSignature` in
   * `aba-payway.signing.ts` for the algorithm itself; this method is just
   * the header lookup + JSON parse around it.
   */
  verifyWebhookSignature(
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ): WebhookVerification {
    const received = headers[SIGNATURE_HEADER];
    if (!received) {
      return { valid: false, reason: `Missing ${SIGNATURE_HEADER} header` };
    }

    let payload: Record<string, unknown>;
    try {
      const text =
        typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { valid: false, reason: 'Malformed JSON body' };
    }

    const valid = verifyAbaPaywayCallbackSignature(
      payload,
      this.apiKey(),
      received,
    );
    return valid
      ? { valid: true }
      : { valid: false, reason: 'Signature mismatch' };
  }

  parseWebhookEvent(rawBody: Buffer | string): ParsedProviderEvent {
    const text =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const body = JSON.parse(text) as AbaPaywayWebhookPayload;

    // `status` is a string code ("0" = approved, per the same convention
    // as check-transaction's `payment_status_code`) — ABA's callback docs
    // don't enumerate the non-zero values, so anything else falls through
    // toPaymentAttemptOutcome's "non-zero numeric code = failed" rule.
    const statusCode = Number(body.status);
    const status = toPaymentAttemptOutcome(
      Number.isNaN(statusCode) ? null : statusCode,
      null,
    );

    return {
      // A retried delivery of the same outcome dedupes; a genuinely
      // different status for the same tran_id is a new event.
      providerEventId: `${body.tran_id}:${body.status}`,
      eventType: 'payment.notify',
      // Echoes charge()'s own tran_id — see the class doc comment. This is
      // what correlates the event back to a payment_attempts row via its
      // (provider, providerAttemptId) index.
      providerAttemptId: body.tran_id,
      status,
      failureCode: status === 'failed' ? body.status : undefined,
      // ABA's callback carries no failure text of its own — reconcile()
      // (check-transaction) is what fills in a fuller picture downstream,
      // not this payload.
      failureMessage: undefined,
      payload: body,
    };
  }

  /**
   * No PAN, bank account, or auth-token field appears in any of the
   * documented ABA PayWay response shapes (see spec.md) — `payer_account`
   * is already a masked summary as ABA returns it. Identity is correct
   * here, not merely unimplemented.
   */
  redact(payload: unknown): unknown {
    return payload;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private apiKey(): string {
    return this.configService.get<string>('abaPayway.apiKey') ?? '';
  }

  private webhookUrl(): string {
    return this.configService.get<string>('abaPayway.webhookUrl') ?? '';
  }

  private merchantId(): string {
    return this.configService.get<string>('abaPayway.merchantId') ?? '';
  }

  private baseUrl(): string {
    return (
      this.configService.get<string>('abaPayway.baseUrl') ??
      'https://checkout-sandbox.abapayway.com'
    );
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    if (!this.apiKey() || !this.merchantId()) {
      throw new Error(
        'ABA PayWay is not configured — set ABA_PAYWAY_API_KEY and ABA_PAYWAY_MERCHANT_ID',
      );
    }

    const url = `${this.baseUrl().replace(/\/$/, '')}/${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`POST ${url} failed with ${response.status}: ${text}`);
      throw new Error(
        `ABA PayWay request to ${path} failed (${response.status})`,
      );
    }

    return (await response.json()) as T;
  }
}
