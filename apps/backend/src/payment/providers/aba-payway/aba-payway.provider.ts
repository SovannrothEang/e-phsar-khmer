import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ChargeRequest,
  ChargeResult,
  ParsedProviderEvent,
  WebhookVerification,
} from '../payment-gateway.types';
import type { PaymentGatewayProvider } from '../payment-gateway.interface';
import { createApiClient, type ApiClient } from '../../../utils/api-client';
import {
  base64EncodeAbaPaywayUrl,
  formatAbaPaywayReqTime,
} from './aba-payway.encoding';
import {
  signAbaPayway,
  signAbaPaywayPurchase,
  verifyAbaPaywayCallbackSignature,
} from './aba-payway.signing';
import {
  ABA_PAYWAY_API_OK,
  toPaymentAttemptOutcome,
} from './aba-payway.status';
import { createAbaPaywayTransaction } from './handlers/create-transaction.handler';
import { checkAbaPaywayTransaction } from './handlers/check-transaction.handler';
import type {
  AbaPaywayWebhookPayload,
  CheckTransactionRequest,
  CreatePurchaseRequest,
} from './aba-payway.types';
import { Effect } from 'effect';

// Node/NestJS lowercase incoming header names regardless of how ABA sends
// `X-PayWay-Hmac-Sha512` on the wire.
const SIGNATURE_HEADER = 'x-payway-hmac-sha512';

/**
 * ABA PayWay's implementation of the gateway seam. The only place that
 * knows PayWay's wire format: the request signature, `status.code`'s
 * meaning, and which response fields become the checkout artifact.
 *
 * `tran_id` sent to ABA is a freshly generated short opaque id — **not**
 * `payment_transactions.id` or `payment_attempts.id` (both 36-character
 * UUIDs, confirmed live to exceed ABA's `tran_id` limit; see
 * `CreatePurchaseRequest.tran_id`'s own doc comment). ABA echoes `tran_id`
 * back verbatim on every subsequent call (check-transaction, the callback
 * body's own `tran_id`), and that echoed value is what `charge()` returns
 * as `ChargeResult.providerAttemptId` — `updatePaymentAttempt` persists it
 * to `payment_attempts.provider_attempt_id`, which is what lets a webhook
 * or a reconcile lookup correlate back to the right attempt. Our own
 * `payment_transactions.id` still travels with the request — as
 * `custom_fields` — purely for manual lookups against ABA's own tooling;
 * nothing in this codebase reads it back out of a response.
 *
 * **`return_url` vs `continue_success_url`/`cancel_url` — do not conflate
 * these.** Despite the name, ABA's `return_url` is a *server-to-server*
 * field: the URL ABA POSTs the payment result to once the payer completes
 * (or abandons) checkout — functionally a per-request webhook target, not
 * a browser redirect. It is always `webhookUrl()` (fixed server config,
 * `ABA_PAYWAY_WEBHOOK_URL`, pointed at the webhooks controller's route)
 * and is never sourced from caller input — a client controlling where
 * ABA's payment-result notification goes would be a real vulnerability.
 * `continue_success_url`/`cancel_url` are the actual browser redirects,
 * and those *are* legitimately caller-supplied, via
 * `ChargeRequest.returnUrl`/`.cancelUrl`. Only `return_url` is
 * base64-encoded before being sent — confirmed against both ABA's own
 * documented field description ("URL to receive callbacks upon payment
 * completion, encrypted with Base64") and its developer docs
 * (developer.payway.com.kh/purchase-14530820e0), which call out base64
 * for `return_url` specifically and say nothing of the sort for
 * `continue_success_url`/`cancel_url` — those two are sent as plain URLs.
 * See `aba-payway.encoding.ts`.
 */
@Injectable()
export class AbaPaywayProvider implements PaymentGatewayProvider {
  readonly name = 'aba_payway';
  private readonly apiClient: ApiClient;

  constructor(private readonly configService: ConfigService) {
    this.apiClient = createApiClient({
      baseUrl: this.baseUrl(),
      // Confirmed live (2026-09-16): without Accept: application/json,
      // ABA's purchase endpoint returns a rendered HTML checkout page
      // (200 OK) instead of the documented JSON body. Content-Type must
      // also be explicit to ensure ABA treats this as a JSON API call.
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  /**
   * A short opaque id for ABA's `tran_id` — see `CreatePurchaseRequest
   * .tran_id`'s own doc comment for why this can't be one of our own UUID
   * columns. 15 random bytes as base64url is exactly 20 characters (no
   * padding, since 15 is divisible by 3) with ~120 bits of entropy —
   * collision-safe at any realistic volume, same order of magnitude as a
   * UUID's own randomness.
   */
  private generateTranId(): string {
    return randomBytes(15).toString('base64url');
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const webhookUrl = this.webhookUrl();
    if (!webhookUrl) {
      throw new Error(
        'ABA PayWay is not configured — set ABA_PAYWAY_WEBHOOK_URL (the ' +
          'server-to-server return_url ABA needs to report a payment ' +
          'outcome; without it a purchase would have nowhere to notify)',
      );
    }
    this.ensureConfigured();

    const reqTime = formatAbaPaywayReqTime(new Date());
    const merchantId = this.merchantId();
    const tranId = this.generateTranId();
    const amount = Number(request.amount);
    const currency = request.currency;

    // Server-to-server payment-result callback — fixed server config,
    // never derived from caller input (see webhookUrl()'s guard above and
    // this class's own doc comment on `return_url`). Only this field gets
    // base64-encoded; see the class doc comment for why the other two
    // don't.
    const returnUrl = base64EncodeAbaPaywayUrl(webhookUrl);
    // `request.returnUrl`/`.cancelUrl` are the generic browser-redirect
    // concepts from ChargeRequest — map to ABA's *browser* redirect
    // fields, different fields from `return_url` above despite the
    // similar name. Sent plain (no base64) — see the class doc comment.
    const continueSuccessUrl = request.returnUrl;
    const cancelUrl = request.cancelUrl;

    // signAbaPaywayPurchase's template has 23 fixed positions; this
    // codebase's ChargeRequest only ever populates a handful of them
    // (below) — every other position (items, shipping, firstname, email,
    // payout, ...) has no equivalent field anywhere in this module and
    // stays empty, per the algorithm itself, not because of anything this
    // request happens to send.
    const hash = signAbaPaywayPurchase(
      {
        reqTime,
        merchantId,
        tranId,
        amount,
        returnUrl,
        cancelUrl: cancelUrl ?? undefined,
        continueSuccessUrl: continueSuccessUrl ?? undefined,
        currency,
        customFields: request.transactionId,
      },
      this.apiKey(),
    );

    const body: CreatePurchaseRequest = {
      req_time: reqTime,
      merchant_id: merchantId,
      tran_id: tranId,
      amount,
      currency,
      return_url: returnUrl,
      // ABA signs missing optional fields as empty string. Sending null
      // would cause the hash to include "null" (the literal string) while
      // ABA verifies with "", producing a signature mismatch (error code 2
      // "Invalid Transaction ID"). Omit the fields entirely when not set.
      ...(continueSuccessUrl
        ? { continue_success_url: continueSuccessUrl }
        : {}),
      ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
      // Our own internal id, for manual lookups against ABA's own
      // tooling only — see the class doc comment. Never read back out of
      // a response by this codebase.
      custom_fields: request.transactionId,
      hash,
    };

    const response = await Effect.runPromise(
      createAbaPaywayTransaction(this.apiClient, body),
    );

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
    //
    // redirectUrl maps to `abapay_deeplink` — the one field in the real
    // response that's an actual URI (`abamobilebank://...`, confirmed
    // live 2026-09-16). There is no `checkout_qr_url` field in ABA's real
    // response (spec.md's documented name for it doesn't exist); the KHQR
    // itself is `qrString` (raw KHQR payload, for rendering your own code)
    // and `qrImage` (a ready-to-display `data:image/png` URI) — both
    // travel through `rawResponse` below, same pattern
    // `../bakong/bakong.provider.ts` uses for its own QR payload, since
    // `ChargeResult` has no dedicated QR field.
    return {
      status: 'pending',
      providerAttemptId: response.status.tran_id,
      providerTransactionId: response.status.tran_id,
      redirectUrl: response.abapay_deeplink,
      rawResponse: response,
    };
  }

  async reconcile(providerTransactionId: string): Promise<ChargeResult> {
    this.ensureConfigured();
    const reqTime = formatAbaPaywayReqTime(new Date());
    const merchantId = this.merchantId();

    const hash = signAbaPayway(
      [reqTime, merchantId, providerTransactionId],
      this.apiKey(),
    );

    const request: CheckTransactionRequest = {
      req_time: reqTime,
      merchant_id: merchantId,
      tran_id: providerTransactionId,
      hash,
    };

    // A network failure (ApiClientError) rejects here, same contract
    // Bakong's reconcile() has — the use-case layer wraps it into
    // PaymentGatewayCallError and asks BullMQ to retry.
    const response = await Effect.runPromise(
      checkAbaPaywayTransaction(this.apiClient, request),
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
    // Fail closed rather than verifying against an empty-string HMAC key —
    // charge()/reconcile() refuse to run unconfigured via ensureConfigured(),
    // and an unconfigured webhook path must refuse the same way instead of
    // silently accepting any signature computed with key `''`.
    if (!this.isConfigured()) {
      return {
        valid: false,
        reason:
          'ABA PayWay is not configured — set ABA_PAYWAY_API_KEY and ABA_PAYWAY_MERCHANT_ID',
      };
    }

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
      // Confirmed against ABA's own developer docs
      // (developer.payway.com.kh) — the previous default
      // (checkout-sandbox.abapayway.com) was never a real ABA domain and
      // would have failed DNS resolution on any live call.
      'https://checkout-sandbox.payway.com.kh'
    );
  }

  /**
   * Public so `processProviderEvent` can check this before calling
   * `reconcile()` — a missing key would otherwise only surface as a thrown
   * Error inside a BullMQ job, retried opaquely until the job's attempts
   * are exhausted (see that use-case's own doc comment).
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey() && this.merchantId());
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error(
        'ABA PayWay is not configured — set ABA_PAYWAY_API_KEY and ABA_PAYWAY_MERCHANT_ID',
      );
    }
  }
}
