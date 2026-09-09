import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsController } from './payment.controller';
import { BullModule } from '@nestjs/bullmq';
import { PAYMENT_GATEWAY_PROVIDERS, PaymentGatewayRegistry } from './providers';
import { PAYMENT_QUEUE } from './payment.constants';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: PAYMENT_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        defaultJobOptions: {
          attempts: configService.get<number>('payment.jobAttempts') ?? 3,
          backoff: {
            type: 'exponential' as const,
            delay: configService.get<number>('payment.jobBackoffMs') ?? 5000,
          },
        },
      }),
    }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentGatewayRegistry,
    // No real gateway wired yet — register concrete PaymentGatewayProvider
    // implementations here (or via a useFactory) as they're built.
    { provide: PAYMENT_GATEWAY_PROVIDERS, useValue: [] },
  ],
  // BullModule re-exported so any future module (e.g. a subscription
  // checkout flow) can `imports: [PaymentModule]` and `@InjectQueue`
  // the same `payments` queue instead of re-registering it. No
  // `@Processor(PAYMENT_QUEUE)` consumer exists yet — jobs enqueued today
  // (see PaymentsController) sit in Redis unconsumed until one is built.
  exports: [PaymentGatewayRegistry, BullModule],
})
export class PaymentModule {}
