import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PaymentEffectRunner } from '../payment/payment-effect-runner.service';
import {
  findPaymentAttemptByProviderAttemptId,
  receivePaymentProviderEvent,
} from '../payment/use-cases';
import { AbaPaywayProvider } from '../payment/providers/aba-payway/aba-payway.provider';

/**
 * ABA PayWay's webhook intake — separated from the payment CRUD controller
 * because this is a provider-specific wire-format handler, not part of the
 * payment lifecycle API. ABA sends its payment notification to this route
 * (configured via ABA_PAYWAY_WEBHOOK_URL env var).
 *
 * Route: POST /api/v1/webhooks/aba-payway
 *
 * No service layer here: signature verification and payload parsing are
 * gateway-specific request validation (plain sync calls on the injected
 * provider, same job a guard would do), not a business action — the one
 * actual write is `receivePaymentProviderEvent`, the same use-case the
 * payment module's own controller used to expose.
 */
@ApiTags('webhooks')
@Controller('webhooks/aba-payway')
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
      "Receive ABA PayWay's payment notification. verifyWebhookSignature() " +
      '(HMAC-SHA512 over the payload, keyed by the merchant API key, ' +
      'checked against the X-PayWay-Hmac-Sha512 header) runs first and ' +
      'rejects with 401 before any DB write.',
  })
  async webhook(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string>,
  ) {
    const rawBody = JSON.stringify(body);
    const verification = this.provider.verifyWebhookSignature(rawBody, headers);
    if (!verification.valid) {
      this.logger.warn(
        `Rejected ABA PayWay webhook: ${verification.reason ?? 'invalid signature'}`,
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const parsed = this.provider.parseWebhookEvent(rawBody);
    const providerName = this.provider.name;

    // Read outside the transaction on purpose — correlating the webhook to
    // an attempt doesn't need transactional isolation with the write below,
    // and there's no reason to hold a transaction open for it.
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

    // ABA PayWay retries on a non-zero `code` in the JSON body, not just on
    // HTTP status — this ack shape is what stops it resending.
    return { code: 0, message: 'Received' };
  }
}
