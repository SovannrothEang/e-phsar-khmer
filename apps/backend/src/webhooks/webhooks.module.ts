import { Module } from '@nestjs/common';
import { AbaPaywayWebhookController } from './aba-payway.controller';
import { PaymentModule } from '../payment/payment.module';

/**
 * Dedicated webhook intake routes — separated from the payment CRUD
 * controller because webhook endpoints are provider-specific wire-format
 * handlers, not part of the payment lifecycle API. Each provider that
 * delivers webhooks gets its own controller here.
 *
 * Imports PaymentModule for access to PaymentEffectRunner and provider
 * instances (AbaPaywayProvider for signature verification).
 */
@Module({
  imports: [PaymentModule],
  controllers: [AbaPaywayWebhookController],
})
export class WebhooksModule {}
