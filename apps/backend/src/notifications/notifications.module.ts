import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { InAppNotificationChannel } from './channels/in-app-notification.channel';
import { NOTIFICATION_CHANNELS } from './notification-channel.interface';

/**
 * User-facing notifications: a durable in-app feed today, an extension
 * point for other channels (email, push) later — see
 * `notification-channel.interface.ts`'s own doc comment. Not `@Global()`,
 * same rationale as `ChatModule`/`OutboxModule`: an importer is making a
 * real choice (it now sends notifications).
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InAppNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      // Add a future channel (e.g. EmailNotificationChannel) to this array —
      // nothing else in the module needs to change.
      inject: [InAppNotificationChannel],
      useFactory: (inApp: InAppNotificationChannel) => [inApp],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
