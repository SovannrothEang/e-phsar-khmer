import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DbClient } from '../../db/drizzle.provider';
import { notifications } from '../../db/schema';
import type {
  NotificationChannel,
  NotificationPayload,
} from '../notification-channel.interface';

/** Persists every notification to the `notifications` table — the durable, always-on channel a client polls/reads via `NotificationsController`. */
@Injectable()
export class InAppNotificationChannel implements NotificationChannel {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async send(payload: NotificationPayload): Promise<void> {
    await this.db.insert(notifications).values({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    });
  }
}
