import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DbClient } from '../db/drizzle.provider';
import { notifications } from '../db/schema';
import type { PaginatedResponse } from '../common/types/api-response.types';
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationPayload,
} from './notification-channel.interface';
import type { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {}

  /**
   * Fires every registered channel. Left as a plain `Promise.all` rather
   * than `allSettled` on purpose: today's only channel (`InAppNotificationChannel`)
   * is the durable record itself, so its failure has to propagate — the
   * caller (an `OutboxHandler`) reports `retry` and the outbox's own backoff
   * tries again. A future best-effort channel (e.g. push) that shouldn't
   * block persistence on a transient failure should catch its own errors
   * inside `send()` rather than change this method's error semantics.
   */
  async notify(payload: NotificationPayload): Promise<void> {
    await Promise.all(this.channels.map((channel) => channel.send(payload)));
  }

  async list(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedResponse<typeof notifications.$inferSelect>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const where = eq(notifications.userId, userId);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(notifications).where(where),
    ]);

    const total = totalRow.value;
    return {
      data: rows,
      meta: {
        nextCursor: null,
        hasMore: offset + rows.length < total,
        limit: pageSize,
        total,
        page,
        pageSize,
      },
    };
  }

  async unreadCount(userId: string): Promise<{ total: number }> {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
    return { total: row.value };
  }

  async markRead(userId: string, id: string): Promise<{ marked: number }> {
    const rows = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      )
      .returning({ id: notifications.id });
    return { marked: rows.length };
  }

  async markAllRead(userId: string): Promise<{ marked: number }> {
    const rows = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      )
      .returning({ id: notifications.id });
    return { marked: rows.length };
  }
}
