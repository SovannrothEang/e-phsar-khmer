import { Module } from '@nestjs/common';
import { PaymentsController } from './payment.controller';
import { BullModule } from '@nestjs/bullmq';

export const PAYMENT_QUEUE = 'payments';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: PAYMENT_QUEUE,
    }),
  ],
  controllers: [PaymentsController],
})
export class PaymentModule {}
