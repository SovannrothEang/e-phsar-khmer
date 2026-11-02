import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ChatPubSubModule } from '../chat/chat-pubsub.module';
import { OutboxModule } from '../outbox/outbox.module';
import { queueRedisOptions } from '../common/queue/queue-connection';
import { InAppNotificationChannel } from './channels/in-app-notification.channel';
import { RealtimeNotificationChannel } from './channels/realtime-notification.channel';
import { NOTIFICATION_CHANNELS } from './notification-channel.interface';
import { PlasGateClient } from './sms/plasgate-client';
import { SMS_RATE_LIMIT_REDIS, SmsRateLimiter } from './sms/sms-rate-limiter';
import { SmsUserLimiter } from './sms/sms-user-limiter';
import { SmsOutboxHandler } from './sms/sms-outbox-handler';

/**
 * User-facing notifications: a durable in-app feed today, a best-effort
 * realtime push, and an opt-in SMS send via the transactional outbox — see
 * `notification-channel.interface.ts`'s own doc comment, and
 * `sms/sms-outbox-handler.ts` for why SMS is deliberately NOT a
 * `NotificationChannel` (it never runs inline). Not `@Global()`, same
 * rationale as `ChatModule`/`OutboxModule`: an importer is making a real
 * choice (it now sends notifications).
 */
@Module({
  imports: [
    // The pubsub leaf provides the socket push transport for the realtime
    // channel without importing the chat feature (which imports AuthModule).
    ChatPubSubModule,
    // `OutboxService`/`OutboxRegistry` — `NotificationsService.notify()`
    // enqueues `notification.sms.requested`, and `SmsOutboxHandler` (below)
    // registers itself as its consumer.
    OutboxModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InAppNotificationChannel,
    RealtimeNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      // Add a future channel (e.g. EmailNotificationChannel) to this array —
      // nothing else in the module needs to change. In-app stays first: it
      // is the durable record, the realtime push is best-effort. SMS is
      // deliberately absent — see the module's doc comment.
      inject: [InAppNotificationChannel, RealtimeNotificationChannel],
      useFactory: (
        inApp: InAppNotificationChannel,
        realtime: RealtimeNotificationChannel,
      ) => [inApp, realtime],
    },
    PlasGateClient,
    SmsRateLimiter,
    SmsUserLimiter,
    SmsOutboxHandler,
    {
      // Dedicated connection, same family as `ChatPubSubService`'s —
      // reusing the BullMQ `QUEUE_*` Redis rather than inventing new env
      // vars. `enableOfflineQueue: false` + a short `connectTimeout` is
      // what makes `SmsRateLimiter.tryAcquire()` fail fast (→ 'unavailable'
      // → the handler's fail-closed `retry`) instead of queuing commands
      // and hanging for `maxRetriesPerRequest`.
      provide: SMS_RATE_LIMIT_REDIS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const client = new Redis({
          ...queueRedisOptions(configService, 'sms-rate-limiter'),
          enableOfflineQueue: false,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
        });
        // An 'error' event with no listener crashes the whole process, not
        // just this client (see the identical note on ChatPubSubService).
        client.on('error', (err) =>
          new Logger('SmsRateLimiterRedis').warn(`Redis error: ${String(err)}`),
        );
        return client;
      },
    },
  ],
  // The SMS building blocks are exported for `OtpModule`, which sends codes
  // through PlasGate directly (never via the outbox).
  exports: [
    NotificationsService,
    PlasGateClient,
    SmsRateLimiter,
    SmsUserLimiter,
  ],
})
export class NotificationsModule {}
