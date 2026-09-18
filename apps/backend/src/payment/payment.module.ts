import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsController } from './payment.controller';
import { PAYMENT_GATEWAY_PROVIDERS, PaymentGatewayRegistry } from './providers';
import { AbaPaywayProvider } from './providers/aba-payway/aba-payway.provider';
import { BakongProvider } from './providers/bakong/bakong.provider';
import { PAYMENT_QUEUE } from './payment.constants';
import { PaymentEffectRunner } from './payment-effect-runner.service';
import { PaymentAttemptOutboxHandler } from './outbox/payment-attempt-outbox-handler';
import { PaymentEventOutboxHandler } from './outbox/payment-event-outbox-handler';
import { PaymentPollOutboxHandler } from './outbox/payment-poll-outbox-handler';
import { PaymentProcessor } from './processors/payment.processor';
import { OutboxModule } from '../outbox/outbox.module';

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
    // Not @Global() — importing it is a real architectural choice (this
    // module now both produces outbox rows and publishes them to BullMQ).
    // See ../outbox/outbox.module.ts's own doc comment.
    OutboxModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentGatewayRegistry,
    AbaPaywayProvider,
    BakongProvider,
    {
      provide: PAYMENT_GATEWAY_PROVIDERS,
      inject: [AbaPaywayProvider, BakongProvider],
      useFactory: (abaPayway: AbaPaywayProvider, bakong: BakongProvider) => [
        abaPayway,
        bakong,
      ],
    },
    PaymentEffectRunner,
    // Publish the three outbox event types this module produces to BullMQ —
    // register themselves with OutboxRegistry from onModuleInit.
    PaymentAttemptOutboxHandler,
    PaymentEventOutboxHandler,
    PaymentPollOutboxHandler,
    // Consumes all three BullMQ job kinds — the first @Processor in this repo.
    PaymentProcessor,
  ],
  // BullModule re-exported so any future module (e.g. a subscription
  // checkout flow) can `imports: [PaymentModule]` and `@InjectQueue` the
  // same `payments` queue instead of re-registering it.
  // PaymentEffectRunner exported for WebhooksModule's controllers.
  exports: [PaymentGatewayRegistry, PaymentEffectRunner, BullModule],
})
export class PaymentModule {}
