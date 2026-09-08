import { Module } from '@nestjs/common';
import { PaymentsController } from './payment.controller';
import { BullModule } from '@nestjs/bullmq';
import { PAYMENT_GATEWAY_PROVIDERS, PaymentGatewayRegistry } from './providers';

export const PAYMENT_QUEUE = 'payments';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: PAYMENT_QUEUE,
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentGatewayRegistry,
    // No real gateway wired yet — register concrete PaymentGatewayProvider
    // implementations here (or via a useFactory) as they're built.
    { provide: PAYMENT_GATEWAY_PROVIDERS, useValue: [] },
  ],
  exports: [PaymentGatewayRegistry],
})
export class PaymentModule {}
