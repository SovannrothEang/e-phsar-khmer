import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { stableStringify } from '../common/stable-stringify.util';
import { DRIZZLE, type DbClient } from '../db/drizzle.provider';
import { notifications, smsDeliveries } from '../db/schema';
import { users } from '../db/schema/users.schema';
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
   * Fires every registered channel, durable first.
   *
   * The in-app channel is the durable record itself and is always first in
   * `NOTIFICATION_CHANNELS`. It must commit before the realtime channel is
   * allowed to publish: a push tells a client to re-read, and a subscriber
   * that refetches before the row is visible would show stale state and never
   * be retried. A durable failure still propagates (the caller — an
   * `OutboxHandler` — reports `retry`), while a best-effort channel must catch
   * its own errors inside `send()`.
   *
   * SMS is NOT one of these channels and never runs inline: `data.sendSms
   * === true` only enqueues a durable `notification.sms.requested` outbox
   * event (`SmsOutboxHandler` in `./sms/` delivers it later, independently
   * of this call).
   */
  async notify(payload: NotificationPayload): Promise<void> {
    const [durable, ...bestEffort] = this.channels;
    if (durable) await durable.send(payload);
    await Promise.all(bestEffort.map((channel) => channel.send(payload)));

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

  /**
   * Fans one payload out to every active staff member (`admin`/`super_admin`).
   * Staff notices are a normal notification per recipient, so the in-app feed
   * and realtime push work unchanged; there is no separate staff feed.
   *
   * Each recipient is attempted independently: one failure is logged and the
   * rest still go out. The staff lookup itself can reject, so a caller that
   * must not fail (e.g. a report insert) still wraps this call.
   */
  async notifyStaff(
    payload: Omit<NotificationPayload, 'userId'>,
  ): Promise<void> {
    const staff = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.role, ['admin', 'super_admin']),
          eq(users.status, 'active'),
          isNull(users.deletedAt),
        ),
      );

    await Promise.all(
      staff.map(async (member) => {
        try {
          await this.notify({ userId: member.id, ...payload });
        } catch (err) {
          this.logger.warn(
            `Could not notify staff ${member.id} (${payload.type}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );
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
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
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

  /**
   * Deletes the notices about one listing — used when the state that produced
   * them is undone (an ad restored or republished) so the feed stops claiming
   * it was removed. `types` is explicit because a caller clears only the
   * notice kinds it knows are stale.
   *
   * `data->>'listingId'` is the key every listing producer already writes, so
   * no schema change is needed. When `userId` is given it is part of the WHERE
   * too: a foreign owner's notices are never touched.
   */
  async removeForListing(
    listingId: string,
    types: string[],
    userId?: string,
  ): Promise<{ deleted: number }> {
    if (types.length === 0) return { deleted: 0 };

    const conditions = [
      inArray(notifications.type, types),
      sql`${notifications.data}->>'listingId' = ${listingId}`,
    ];
    if (userId) conditions.push(eq(notifications.userId, userId));

    const rows = await this.db
      .delete(notifications)
      .where(and(...conditions))
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
