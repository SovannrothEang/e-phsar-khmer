import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from 'drizzle-orm';
import { DRIZZLE, type DbClient } from '../db/drizzle.provider';
import { listings, notifications, users } from '../db/schema';
import { NotificationsService } from '../notifications/notifications.service';
import type { NotificationPayload } from '../notifications/notification-channel.interface';
import { quotedTitle } from '../notifications/notice-title';
import {
  DAY_MS,
  EXPIRED_LOOKBACK_MS,
  EXPIRING_WINDOW_MS,
} from './listing-expiry.constants';

type ExpiryCandidate = {
  id: string;
  userId: string;
  title: string;
  expiresAt: Date;
};

/**
 * How far back the (listingId, expiresAt) dedupe looks. An expiry notice is
 * only ever produced inside the 3-day warning window or the 24-hour lapse
 * lookback, so a notice older than this cannot suppress a current one.
 */
const UNNOTIFIED_LOOKBACK_MS = 4 * DAY_MS;

/** Candidates per keyset page, so a backlog cannot be loaded into memory. */
const SWEEP_PAGE_SIZE = 200;
/** Hard cap on pages per sweep, so one run cannot loop forever. */
const SWEEP_MAX_PAGES = 50;

/**
 * Tells owners their ad is about to lapse and, once, that it has lapsed.
 *
 * The ad itself never changes status when `expires_at` passes — expiry is
 * derived at read time (see `ListingsService.liveConditions`) — so this
 * sweep is the only thing that tells the owner why their ad left the feed.
 * Each notice is deduped by (listingId, expiresAt): a renewal resets the
 * date, so the next window earns a fresh warning.
 */
@Injectable()
export class ListingExpiryService {
  private readonly logger = new Logger(ListingExpiryService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly notifications: NotificationsService,
  ) {}

  async sweep(
    now: Date = new Date(),
  ): Promise<{ expiring: number; expired: number }> {
    const expiring = await this.notifyExpiring(now);
    const expired = await this.notifyExpired(now);
    return { expiring, expired };
  }

  /** Ads inside the warning window: `now < expires_at <= now + 3 days`. */
  private async notifyExpiring(now: Date): Promise<number> {
    const until = new Date(now.getTime() + EXPIRING_WINDOW_MS);
    return this.notifyWindow(
      'listing.expiring',
      now,
      { from: now, to: until },
      (row) => {
        const days = Math.max(
          1,
          Math.ceil((row.expiresAt.getTime() - now.getTime()) / DAY_MS),
        );
        return {
          userId: row.userId,
          type: 'listing.expiring',
          title: `Your ad ${quotedTitle(row.title)} expires in ${days} day${days === 1 ? '' : 's'}`,
          body: 'Renew it from Manage Ads to keep it live in the marketplace.',
          data: {
            listingId: row.id,
            expiresAt: row.expiresAt.toISOString(),
            days,
          },
        };
      },
    );
  }

  /** Ads that lapsed in the last 24 h — the grace window for the notice. */
  private async notifyExpired(now: Date): Promise<number> {
    const since = new Date(now.getTime() - EXPIRED_LOOKBACK_MS);
    return this.notifyWindow(
      'listing.expired',
      now,
      { from: since, to: now },
      (row) => ({
        userId: row.userId,
        type: 'listing.expired',
        title: `Your ad ${quotedTitle(row.title)} has expired`,
        body: 'Renew it from Manage Ads to put it back on the marketplace.',
        data: { listingId: row.id, expiresAt: row.expiresAt.toISOString() },
      }),
    );
  }

  /**
   * Walks one `expires_at` window in keyset pages and sends the notices that
   * are not already recorded. The cursor is local to the run: a restart starts
   * from the oldest row again, which re-checks a page instead of skipping the
   * rest — the failure mode a cross-run cursor had on a scale-to-zero host.
   */
  private async notifyWindow(
    type: string,
    now: Date,
    range: { from: Date; to: Date },
    build: (row: ExpiryCandidate) => NotificationPayload,
  ): Promise<number> {
    let sent = 0;
    let cursor: { expiresAt: Date; id: string } | null = null;

    for (let page = 0; page < SWEEP_MAX_PAGES; page++) {
      const rows = await this.db
        .select({
          id: listings.id,
          userId: listings.userId,
          title: listings.title,
          expiresAt: listings.expiresAt,
        })
        .from(listings)
        .innerJoin(users, eq(users.id, listings.userId))
        .where(
          and(
            eq(listings.status, 'active'),
            isNotNull(listings.expiresAt),
            cursor
              ? or(
                  gt(listings.expiresAt, cursor.expiresAt),
                  and(
                    eq(listings.expiresAt, cursor.expiresAt),
                    gt(listings.id, cursor.id),
                  ),
                )
              : gt(listings.expiresAt, range.from),
            lte(listings.expiresAt, range.to),
            isNull(users.deletedAt),
          ),
        )
        .orderBy(asc(listings.expiresAt), asc(listings.id))
        .limit(SWEEP_PAGE_SIZE);

      const pending = await this.unnotified(type, rows, now);
      for (const row of pending) {
        if (await this.send(build(row))) sent++;
      }

      if (rows.length < SWEEP_PAGE_SIZE) break;
      const last = rows[rows.length - 1] as
        | { id: string; expiresAt: Date | null }
        | undefined;
      if (!last || !last.expiresAt) break;
      cursor = { expiresAt: last.expiresAt, id: last.id };
    }

    return sent;
  }

  /**
   * Drops candidates whose (listingId, expiresAt) already produced a notice
   * of this type. The key lives in `data`, so no extra column or migration.
   * History is bounded to the notice's own horizon: older rows cannot match a
   * candidate still inside the warning/lapse window.
   */
  private async unnotified(
    type: string,
    rows: {
      id: string;
      userId: string;
      title: string;
      expiresAt: Date | null;
    }[],
    now: Date,
  ): Promise<ExpiryCandidate[]> {
    const candidates = rows.filter(
      (row): row is ExpiryCandidate => row.expiresAt !== null,
    );
    if (candidates.length === 0) return [];

    const userIds = [...new Set(candidates.map((row) => row.userId))];
    const existing = await this.db
      .select({ data: notifications.data })
      .from(notifications)
      .where(
        and(
          eq(notifications.type, type),
          inArray(notifications.userId, userIds),
          gte(
            notifications.createdAt,
            new Date(now.getTime() - UNNOTIFIED_LOOKBACK_MS),
          ),
        ),
      );
    const seen = new Set(
      existing.map((row) => {
        const data = row.data;
        return `${String(data.listingId)}:${String(data.expiresAt)}`;
      }),
    );
    return candidates.filter(
      (row) => !seen.has(`${row.id}:${row.expiresAt.toISOString()}`),
    );
  }

  /** One failed notice must not abort the sweep — the next run retries it. */
  private async send(payload: NotificationPayload): Promise<boolean> {
    try {
      await this.notifications.notify(payload);
      return true;
    } catch (err) {
      this.logger.warn(
        `Could not notify ${payload.userId} (${payload.type}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
