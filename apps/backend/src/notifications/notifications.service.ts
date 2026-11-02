import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, count, desc, eq } from 'drizzle-orm';
import { stableStringify } from '../common/stable-stringify.util';
import { DRIZZLE, type DbClient } from '../db/drizzle.provider';
import { notifications, smsDeliveries } from '../db/schema';
import type { PaginatedResponse } from '../common/types/api-response.types';
import { OutboxService } from '../outbox/outbox.service';
import {
  SMS_REQUESTED_MAX_ATTEMPTS,
  SMS_REQUESTED_OUTBOX_EVENT_TYPE,
} from './sms/sms-outbox-events';
import type { SmsOutboxPayload } from './sms/sms-outbox-handler';
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationPayload,
} from './notification-channel.interface';
import type { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Fires every registered channel. Left as a plain `Promise.all` rather
   * than `allSettled` on purpose: today's only channel (`InAppNotificationChannel`)
   * is the durable record itself, so its failure has to propagate — the
   * caller (an `OutboxHandler`) reports `retry` and the outbox's own backoff
   * tries again. A future best-effort channel (e.g. push) that shouldn't
   * block persistence on a transient failure should catch its own errors
   * inside `send()` rather than change this method's error semantics.
   *
   * SMS is NOT one of these channels and never runs inline: `data.sendSms
   * === true` only enqueues a durable `notification.sms.requested` outbox
   * event (`SmsOutboxHandler` in `./sms/` delivers it later, independently
   * of this call). The in-app/realtime row this method writes is wholly
   * unaffected by whether SMS is sendable, configured or even attempted —
   * that decoupling is the entire point of moving it off this call stack.
   */
  async notify(payload: NotificationPayload): Promise<void> {
    await Promise.all(this.channels.map((channel) => channel.send(payload)));

    if (payload.data?.sendSms === true) {
      // Best-effort: the in-app row above is already committed, and a caller
      // that retries on a throw (e.g. an outbox handler) would write it a
      // second time. An SMS that could not even be queued is logged, not
      // propagated.
      try {
        await this.enqueueSms(payload);
      } catch (err) {
        this.logger.warn(
          `Could not queue SMS for ${payload.type} to ${payload.userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async enqueueSms(payload: NotificationPayload): Promise<void> {
    const dedupeKey = this.buildSmsDedupeKey(payload);
    const content = payload.body
      ? `${payload.title}\n${payload.body}`
      : payload.title;

    // One transaction: an outbox event with no audit row would be sent (or
    // skipped) with nothing recorded, because the handler's later updates
    // match zero rows without throwing.
    await this.db.transaction(async (tx) => {
      const event = await this.outbox.enqueue<SmsOutboxPayload>(tx, {
        eventType: SMS_REQUESTED_OUTBOX_EVENT_TYPE,
        aggregateType: 'user',
        aggregateId: payload.userId,
        dedupeKey,
        payload: {
          userId: payload.userId,
          notificationType: payload.type,
          content,
        },
        maxAttempts: SMS_REQUESTED_MAX_ATTEMPTS,
      });

      // `onConflictDoNothing` on `outboxEventId` is what makes this a no-op
      // the second time `enqueue` returns the SAME (dedupe-collided) row —
      // exactly one `sms_deliveries` row per distinct dedupe key.
      await tx
        .insert(smsDeliveries)
        .values({
          userId: payload.userId,
          notificationType: payload.type,
          status: 'queued',
          outboxEventId: event.id,
        })
        .onConflictDoNothing({ target: smsDeliveries.outboxEventId });
    });

    this.outbox.wakeupAfterCommit();
  }

  /**
   * `userId + type + a stable id from data` — stable because a producer
   * (e.g. the hourly listing-expiry sweep) calls `notify()` with the same
   * `data` shape every time for the same logical event, the same rule
   * `listing.expiring`/`listing.expired` already dedupe on. `data` is
   * stringified with sorted keys (`stableStringify`) so key order never
   * changes the hash.
   */
  private buildSmsDedupeKey(payload: NotificationPayload): string {
    const stable = stableStringify(payload.data ?? {});
    const hash = createHash('sha256').update(stable).digest('hex').slice(0, 16);
    return `sms:${payload.userId}:${payload.type}:${hash}`;
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

  /**
   * Deletes one notification, scoped to its owner — a foreign id matches no
   * row and reports `{ deleted: 0 }` rather than 404, the same shape (and the
   * same no-existence-oracle reasoning) as `markRead`'s `{ marked: 0 }`.
   *
   * A real DELETE, not a soft one: this table has no `deletedAt`, and the
   * notification is a user-facing artifact — the durable record of whatever
   * produced it lives in its own table (a payment, an outbox event), so
   * dismissing the notice never destroys evidence.
   */
  async remove(userId: string, id: string): Promise<{ deleted: number }> {
    const rows = await this.db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    return { deleted: rows.length };
  }

  /** Deletes every notification this user owns. Same scoping as `remove`. */
  async removeAll(userId: string): Promise<{ deleted: number }> {
    const rows = await this.db
      .delete(notifications)
      .where(eq(notifications.userId, userId))
      .returning({ id: notifications.id });
    return { deleted: rows.length };
  }
}
