import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Effect } from 'effect';
import type {
  ChargeRequest,
  ChargeResult,
  ParsedProviderEvent,
  WebhookVerification,
} from '../payment-gateway.types';
import type { PaymentGatewayProvider } from '../payment-gateway.interface';
import { createBakongTransaction } from './handlers/create-transaction.handler';
import { checkBakongTransaction } from './handlers/check-transaction.handler';
import { toPaymentAttemptOutcome } from './bakong.status';
import { createApiClient, type ApiClient } from '../../../utils/api-client';
import type { BakongAccountConfig } from './bakong.types';

/**
 * Bakong's implementation of the gateway seam — and a genuinely different
 * shape from ABA PayWay's. ABA has a server-side "create purchase" call and
 * an optional signed webhook; Bakong has **neither**. A KHQR is generated
 * entirely offline (no network round trip), and the only way to learn
 * whether a payer actually scanned and paid is to poll
 * `check_transaction_by_md5` — there is no push channel at all in this flow.
 *
 * This class is deliberately thin: `createBakongTransaction` and
 * `checkBakongTransaction` (`./handlers/`) are the actual actions, written
 * as `Effect.fn`s (typed failures, free tracing spans, easy to layer
 * retry/timeout onto later) so they compose the same way the module's other
 * use-cases do. `PaymentGatewayProvider` itself has to stay Promise-based —
 * NestJS DI and the interface both require it — so this provider is the
 * thin Promise boundary that runs those Effects, the same role
 * `PaymentEffectRunner` plays for the controllers.
 *
 * `charge()` sets `ChargeResult.poll` on its `pending` result, which is what
 * asks `processPaymentAttempt` to schedule the first `reconcile()` poll
 * (`poll-attempt` BullMQ job, via `payment.attempt.poll_requested` in the
 * outbox) instead of waiting for a callback that will never arrive — see
 * `README.md` in this directory for the full poll-loop architecture.
 */
@Injectable()
export class BakongProvider implements PaymentGatewayProvider {
  readonly name = 'bakong';

  private readonly apiClient: ApiClient;

  constructor(private readonly configService: ConfigService) {
    this.apiClient = createApiClient({
      baseUrl: this.baseUrl(),
      headers: this.apiKey()
        ? { Authorization: `Bearer ${this.apiKey()}` }
        : undefined,
    });
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const account = this.accountConfig();
    if (!account.accountId || !account.displayName) {
      throw new Error(
        'Bakong is not configured — set BAKONG_ACCOUNT_ID and ' +
          'BAKONG_MERCHANT_NAME',
      );
    }
    if (
      account.type === 'merchant' &&
      (!account.merchantId || !account.acquiringBank)
    ) {
      throw new Error(
        'Bakong is not configured for merchant KHQR — set BAKONG_MERCHANT_ID ' +
          'and BAKONG_ACQUIRING_BANK, or set BAKONG_MERCHANT_TYPE=individual ' +
          'if you only have a personal Bakong account',
      );
    }

    const result = await Effect.runPromise(
      createBakongTransaction(request, account, this.qrExpirySeconds()),
    );

    if (!result.ok) {
      return {
        status: 'failed',
        failureCode:
          result.errorCode !== undefined ? String(result.errorCode) : undefined,
        failureMessage: result.errorMessage,
        rawResponse: result.raw,
      };
    }

    // A generated KHQR only means the payer *can* pay — nothing has moved
    // yet, and nothing will ever tell us it did unless something polls.
    // `poll` is what wires that up (see this class's own doc comment).
    return {
      status: 'pending',
      providerAttemptId: result.md5,
      providerTransactionId: result.md5,
      rawResponse: {
        qr: result.qr,
        md5: result.md5,
        expiresAt: result.expiresAt,
      },
      poll: {
        intervalMs: this.pollIntervalMs(),
        expiresAt: result.expiresAt,
      },
    };
  }

  async reconcile(providerTransactionId: string): Promise<ChargeResult> {
    if (!this.apiKey()) {
      throw new Error('Bakong is not configured — set BAKONG_API_KEY');
    }

    // A network failure (ApiClientError) rejects here, same contract ABA's
    // reconcile() has — the use-case layer wraps it into
    // PaymentGatewayCallError and asks BullMQ to retry (see
    // ../../use-cases/payments/errors.ts's doc comment on that error).
    const response = await Effect.runPromise(
      checkBakongTransaction(this.apiClient, providerTransactionId),
    );

    return {
      status: toPaymentAttemptOutcome(response),
      providerTransactionId,
      rawResponse: response,
    };
  }

  /**
   * Bakong's KHQR flow delivers no webhook at all — there is no signature
   * to verify because there is no callback. Always invalid, so
   * `PaymentsController.webhook()`'s generic intake (and any future
   * Bakong-specific route) can never act on an unconfirmed claim; the
   * `reconcile()` poll is the only trusted source of truth for this
   * provider.
   */
  verifyWebhookSignature(): WebhookVerification {
    return {
      valid: false,
      reason: 'Bakong KHQR delivers no webhooks — nothing to verify',
    };
  }

  /**
   * Never reached in practice: `verifyWebhookSignature()` always rejects
   * first, so nothing should call this. Throwing (rather than fabricating a
   * ParsedProviderEvent) makes a caller that skips the signature check a
   * loud bug instead of a silent no-op.
   */
  parseWebhookEvent(): ParsedProviderEvent {
    throw new Error(
      'Bakong does not deliver webhooks; this should never be called',
    );
  }

  /**
   * `check_transaction_by_md5`'s documented fields carry no PAN or bank
   * account number — `fromAccountId`/`toAccountId` are Bakong account
   * aliases, not raw account numbers. Not independently verified against a
   * real response payload (see `bakong.types.ts`'s doc comment) — revisit
   * if a live call turns out to include something more sensitive.
   */
  redact(payload: unknown): unknown {
    return payload;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private accountConfig(): BakongAccountConfig {
    const accountId = this.configService.get<string>('bakong.accountId') ?? '';
    const displayName =
      this.configService.get<string>('bakong.merchantName') ?? '';
    const city =
      this.configService.get<string>('bakong.merchantCity') ?? 'Phnom Penh';

    if (this.merchantType() === 'individual') {
      return { type: 'individual', accountId, displayName, city };
    }

    return {
      type: 'merchant',
      accountId,
      displayName,
      city,
      merchantId: this.configService.get<string>('bakong.merchantId') ?? '',
      acquiringBank:
        this.configService.get<string>('bakong.acquiringBank') ?? '',
    };
  }

  private merchantType(): 'individual' | 'merchant' {
    return (
      this.configService.get<'individual' | 'merchant'>(
        'bakong.merchantType',
      ) ?? 'individual'
    );
  }

  private qrExpirySeconds(): number {
    return this.configService.get<number>('bakong.qrExpirySeconds') ?? 300;
  }

  private pollIntervalMs(): number {
    return this.configService.get<number>('bakong.pollIntervalMs') ?? 4000;
  }

  private apiKey(): string {
    return this.configService.get<string>('bakong.apiKey') ?? '';
  }

  private baseUrl(): string {
    return (
      this.configService.get<string>('bakong.baseUrl') ??
      'https://api-bakong.nbc.gov.kh'
    );
  }
}
