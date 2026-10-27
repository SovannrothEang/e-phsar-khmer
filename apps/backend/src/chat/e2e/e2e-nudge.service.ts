import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { listings } from '../../db/schema/listings.schema';
import { notifications } from '../../db/schema/notifications.schema';
import { users } from '../../db/schema/users.schema';
import { isBlockedEitherWay } from '../blocks.util';
import { NotificationsService } from '../../notifications/notifications.service';
import type { NudgeDto } from './dto/nudge.dto';

/** Notification `type` for the content-free nudge — see `nudge()` below. */
export const E2E_NUDGE_NOTIFICATION_TYPE = 'chat.e2e_nudge';

/** At most one nudge per (sender, recipient) pair inside this window. */
export const NUDGE_COOLDOWN_HOURS = 24;

/**
 * "Someone wants to chat" — fired once by a sender whose browser just
 * discovered the recipient has no E2E device at all (so the message it
 * tried to send is being HELD locally, never sent plaintext). The whole
 * point is that nothing the sender typed, and no plaintext of any kind,
 * ever reaches this endpoint or the notification it creates: only user ids
 * and, optionally, a listing's *stored* title.
 */
@Injectable()
export class E2eNudgeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly notifications: NotificationsService,
  ) {}

  async nudge(
    senderId: string,
    recipientId: string,
    dto: NudgeDto,
  ): Promise<{ sent: boolean }> {
    // Unknown user → 404. listActiveDevices (chats/e2e/users/:id/devices)
    // already answers an unknown id with an empty array rather than a 404,
    // so this check reveals nothing that endpoint doesn't already imply —
    // it just reports it as a 404 instead of a silent empty result.
    const [recipient] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);
    if (!recipient) throw new NotFoundException('User not found');

    if (await isBlockedEitherWay(this.db, senderId, recipientId)) {
      throw new ForbiddenException('Messaging unavailable');
    }

    const since = new Date(Date.now() - NUDGE_COOLDOWN_HOURS * 60 * 60 * 1000);
    const [recent] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, recipientId),
          eq(notifications.type, E2E_NUDGE_NOTIFICATION_TYPE),
          gte(notifications.createdAt, since),
          sql`${notifications.data} ->> 'senderId' = ${senderId}`,
        ),
      )
      .limit(1);
    if (recent) return { sent: false };

    let listingTitle: string | null = null;
    if (dto.listingId) {
      const [listing] = await this.db
        .select({ title: listings.title })
        .from(listings)
        .where(eq(listings.id, dto.listingId))
        .limit(1);
      listingTitle = listing?.title ?? null;
    }

    await this.notifications.notify({
      userId: recipientId,
      type: E2E_NUDGE_NOTIFICATION_TYPE,
      // No sender-provided text of any kind — only the listing's own stored
      // title, when one was attached and still exists.
      title: listingTitle
        ? `Someone wants to chat with you about "${listingTitle}"`
        : 'Someone wants to chat with you',
      data: {
        senderId,
        listingId: dto.listingId ?? null,
        listingTitle,
      },
    });

    return { sent: true };
  }
}
