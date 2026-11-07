import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBody,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SkipEnvelope } from '../../common/decorators/skip-envelope.decorator';
import { PaymentEffectRunner } from '../payment-effect-runner.service';
import {
  findPaymentAttemptByProviderAttemptId,
  receivePaymentProviderEvent,
} from '../use-cases';
import { AbaPaywayProvider } from '../providers/aba-payway/aba-payway.provider';

/**
 * ABA PayWay's callback intake (`return_url` = `ABA_PAYWAY_WEBHOOK_URL`).
 * Verify the signature, then store the event and enqueue it — nothing is
 * written for a bad callback.
 *
 * Route: POST /api/v1/payments/webhooks/aba-payway
 *
 * Legacy alias `webhooks/aba-payway`: ABA gets the callback URL per
 * transaction, so checkouts created before the move still call the old path.
 * Drop it once none are unresolved (the reconciler covers a missed callback).
 *
 * `@SkipEnvelope()` is part of the external contract: ABA treats a top-level
 * `code: 0` in the body as success, so the global `{ success, data }` wrapper
 * would look like a failure and trigger endless retries. `@SkipThrottle()`
 * because the callback is server-to-server and a retry burst from one ABA IP
 * must not be dropped.
 */
@ApiTags('webhooks')
@SkipEnvelope()
@SkipThrottle()
@Controller(['payments/webhooks/aba-payway', 'webhooks/aba-payway'])
export class AbaPaywayWebhookController {
  private readonly logger = new Logger(AbaPaywayWebhookController.name);

  constructor(
    private readonly effectRunner: PaymentEffectRunner,
    private readonly provider: AbaPaywayProvider,
  ) {}

  @Post()
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary:
      "Receive ABA PayWay's payment notification (401 on a bad " +
      'X-PayWay-Hmac-Sha512 signature, before any write)',
  })
  async webhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
    @RawBody() rawBytes?: Buffer,
  ) {
    // The signature covers the bytes ABA sent, so verification uses the raw
    // body (`rawBody: true` in main.ts). The re-encoded body is only the
    // fallback for a runtime where the raw body was not captured, and it says
    // so in the log — a silent fallback would hide a canonicalization bug.
    const rawBody =
      rawBytes && rawBytes.length > 0
        ? rawBytes
        : Buffer.from(JSON.stringify(body), 'utf-8');
    if (!rawBytes || rawBytes.length === 0) {
      this.logger.warn(
        'ABA PayWay webhook arrived without a raw body; verifying the re-encoded payload',
      );
    }

    const verification = this.provider.verifyWebhookSignature(rawBody, headers);
    if (!verification.valid) {
      // Deliberately no write: the event is left unconsumed, ABA retries, and
      // the reconciler settles the attempt from the provider API. The line is
      // the metric — a run of these means the key or the raw-body wiring
      // broke, not that a customer stopped paying.
      this.logger.warn(
        `Rejected ABA PayWay webhook (${verification.reason ?? 'invalid signature'}); ` +
          `attempt left for reconciliation: ${describeCallback(rawBody)}`,
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Signed but unusable (no tran_id): a 400, not a 500.
    let parsed: ReturnType<AbaPaywayProvider['parseWebhookEvent']>;
    try {
      parsed = this.provider.parseWebhookEvent(rawBody);
    } catch (error) {
      this.logger.warn(
        `Unusable ABA PayWay webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Malformed ABA PayWay callback');
    }
    const providerName = this.provider.name;

    // Correlation is a plain read; it needs no transaction.
    const attempt = parsed.providerAttemptId
      ? await this.effectRunner.run(
          findPaymentAttemptByProviderAttemptId({
            provider: providerName,
            providerAttemptId: parsed.providerAttemptId,
          }),
        )
      : undefined;

    await this.effectRunner.runDurably((outbox) =>
      receivePaymentProviderEvent(outbox, {
        provider: providerName,
        providerEventId: parsed.providerEventId,
        eventType: parsed.eventType,
        payload: body,
        paymentAttemptId: attempt?.id,
      }),
    );

    // ABA retries on a non-zero `code` in the body, not just on HTTP status.
    // Exactly `{ code: 0 }` — see spec.md; the envelope is skipped above.
    return { code: 0 };
  }
}

/**
 * The correlation ids a human needs from a rejected callback, without the
 * payload: `tran_id` finds the attempt, `status` says what ABA claimed.
 */
function describeCallback(rawBody: Buffer): string {
  try {
    const parsed = JSON.parse(rawBody.toString('utf-8')) as Record<
      string,
      unknown
    > | null;
    if (!parsed || typeof parsed !== 'object') return 'unparsable body';
    const tranId = parsed.tran_id;
    const status = parsed.status;
    return `tran_id=${
      typeof tranId === 'string' || typeof tranId === 'number'
        ? String(tranId)
        : '?'
    } status=${
      typeof status === 'string' || typeof status === 'number'
        ? String(status)
        : '?'
    }`;
  } catch {
    return 'unparsable body';
  }
}
