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
import { Public } from '../../../common/decorators/public.decorator';
import { PaymentEffectRunner } from '../../payment-effect-runner.service';
import {
  findPaymentAttemptByProviderAttemptId,
  receivePaymentProviderEvent,
} from '../../use-cases';
import { AbaPaywayProvider } from './aba-payway.provider';

/**
 * ABA PayWay's own webhook intake. Its documented notification payload
 * (`transaction_id`, `payment_status_code`, ...) doesn't match the generic
 * `PaymentsController.webhook()` envelope (`{provider, providerEventId,
 * eventType, payload}`), so it gets a dedicated route rather than requiring
 * ABA to be taught a shape it doesn't send.
 *
 * No service layer here: signature verification and payload parsing are
 * gateway-specific request validation (plain sync calls on the injected
 * provider, same job a guard would do), not a business action — the one
 * actual write is `receivePaymentProviderEvent`, the same use-case the
 * generic webhook route calls.
 */
@ApiTags('payments')
@Controller('payments/aba-payway')
export class AbaPaywayController {
  private readonly logger = new Logger(AbaPaywayController.name);

  constructor(
    private readonly effectRunner: PaymentEffectRunner,
    private readonly provider: AbaPaywayProvider,
  ) {}

  @Post('webhook')
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
