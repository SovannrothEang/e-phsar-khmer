import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import {
  listings,
  listingPhotos,
  type ListingRow,
} from '../db/schema/listings.schema';
import { categories, subcategories } from '../db/schema/categories.schema';
import { users } from '../db/schema/users.schema';
import { listingReports } from '../db/schema/reports.schema';
import type { PaginatedResponse } from '../common/types/api-response.types';
import { ListingsService } from '../listings/listings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { quotedTitle } from '../notifications/notice-title';
import type { ListAdminListingsDto } from './dto/list-admin-listings.dto';
import { likeTerm } from '../utils/like-term';

export interface AdminListingRow {
  id: string;
  title: string;
  status: string;
  price: string | null;
  currency: string;
  userId: string;
  sellerUsername: string | null;
  categorySlug: string | null;
  subcategorySlug: string | null;
  coverPhotoUrl: string | null;
  pendingReports: number;
  createdAt: Date;
  publishedAt: Date | null;
  expiresAt: Date | null;
  moderatedAt: Date | null;
  moderationReason: string | null;
  inactiveAt: Date | null;
  inactiveReason: string | null;
  /** Set on a permanent delete: the dashboard must not offer Restore. */
  deletedAt: Date | null;
}

/**
 * The admin side of listings: browse every ad regardless of status, and take
 * one down / put it back. The take-down itself lives in ListingsService
 * (`moderate` / `restoreModerated`) so the owner-facing guards and the admin
 * action share one definition of "moderated".
 */
@Injectable()
export class AdminListingsService {
  private readonly logger = new Logger(AdminListingsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly listingsService: ListingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    dto: ListAdminListingsDto,
  ): Promise<PaginatedResponse<AdminListingRow>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (dto.status) conditions.push(eq(listings.status, dto.status));
    if (dto.userId) conditions.push(eq(listings.userId, dto.userId));
    if (dto.categorySlug)
      conditions.push(eq(categories.slug, dto.categorySlug));
    if (dto.subcategorySlug)
      conditions.push(eq(subcategories.slug, dto.subcategorySlug));
    if (dto.moderated === true)
      conditions.push(isNotNull(listings.moderatedAt));
    if (dto.moderated === false) conditions.push(isNull(listings.moderatedAt));
    if (dto.q) conditions.push(ilike(listings.title, likeTerm(dto.q)));
    const where = conditions.length ? and(...conditions) : undefined;

    const pendingReports = sql<number>`(
      select count(*)::int from ${listingReports}
      where ${listingReports.listingId} = ${listings.id}
        and ${listingReports.status} = 'pending'
    )`;

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select({
          id: listings.id,
          title: listings.title,
          status: listings.status,
          price: listings.price,
          currency: listings.currency,
          userId: listings.userId,
          sellerUsername: users.username,
          categorySlug: categories.slug,
          subcategorySlug: subcategories.slug,
          pendingReports,
          createdAt: listings.createdAt,
          publishedAt: listings.publishedAt,
          expiresAt: listings.expiresAt,
          moderatedAt: listings.moderatedAt,
          moderationReason: listings.moderationReason,
          inactiveAt: listings.inactiveAt,
          inactiveReason: listings.inactiveReason,
          // The admin table needs this to tell a legacy restorable removal
          // from a permanent one (2026-11-08).
          deletedAt: listings.deletedAt,
        })
        .from(listings)
        .leftJoin(users, eq(users.id, listings.userId))
        .leftJoin(categories, eq(categories.id, listings.categoryId))
        .leftJoin(subcategories, eq(subcategories.id, listings.subcategoryId))
        .where(where)
        .orderBy(desc(listings.createdAt), desc(listings.id))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(listings).where(where),
    ]);

    // First photo per listing, for the table thumbnail.
    const cover = new Map<string, string>();
    if (rows.length) {
      const photos = await this.db
        .select({ listingId: listingPhotos.listingId, url: listingPhotos.url })
        .from(listingPhotos)
        .where(
          inArray(
            listingPhotos.listingId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(listingPhotos.sort);
      for (const p of photos) {
        if (!cover.has(p.listingId)) cover.set(p.listingId, p.url);
      }
    }

    const total = totalRow.value;
    return {
      data: rows.map((r) => ({ ...r, coverPhotoUrl: cover.get(r.id) ?? null })),
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

  /**
   * Permanent take-down. The seller is told why (this is the only channel that
   * ever does). A repeat request on an already-removed row must not send a
   * second notice, so the prior state is read first.
   */
  async remove(id: string, moderatorId: string, reason: string) {
    const existing = await this.moderationState(id);
    const row = await this.listingsService.moderate(id, moderatorId, reason);
    if (!existing.moderatedAt) {
      await this.notifyOwnerOfModeration(row, 'removed', reason);
    }
    return row;
  }

  /**
   * Hide the ad until staff restores it. Unlike `remove` the row is not
   * deleted: the owner can still edit it, but `publish` refuses it with
   * `LISTING_INACTIVE_BY_STAFF` — lifting the hide is staff work.
   */
  async inactivate(id: string, moderatorId: string, reason: string) {
    const existing = await this.moderationState(id);
    const row = await this.listingsService.inactivate(id, moderatorId, reason);
    if (existing.status !== 'inactive') {
      await this.notifyOwnerOfModeration(row, 'inactive', reason);
    }
    return row;
  }

  restore(id: string) {
    return this.listingsService.restoreStaffHidden(id);
  }

  private async moderationState(
    id: string,
  ): Promise<{ status: ListingRow['status']; moderatedAt: Date | null }> {
    const [row] = await this.db
      .select({ status: listings.status, moderatedAt: listings.moderatedAt })
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Listing not found');
    return row;
  }

  /**
   * Best-effort after the DB write. A notification failure must never turn a
   * completed moderation into an error the admin would retry — which would
   * publish a duplicate notice. Mirrors `listing.otp_verified`'s best-effort
   * contract rather than the outbox handlers' retry contract.
   *
   * Public because other take-down paths (approving a listing report) commit
   * the moderation through `ListingsService.moderate` in their own transaction
   * and must announce it only after that transaction resolves.
   */
  async notifyOwnerOfModeration(
    row: ListingRow,
    action: 'removed' | 'inactive',
    reason: string,
  ): Promise<void> {
    const quoted = quotedTitle(row.title);
    const why = reason.trim();
    const notice =
      action === 'removed'
        ? {
            type: 'listing.removed',
            title: `Your ad ${quoted} was removed by an administrator`,
            body: `Reason: ${why}. It is no longer visible in the marketplace and cannot be republished. If you believe this is a mistake, contact support.`,
            data: {
              listingId: row.id,
              listingTitle: row.title,
              reason: why,
              action,
            },
          }
        : {
            type: 'listing.inactivated',
            title: `Your ad ${quoted} was set inactive`,
            // The owner cannot lift this any more (2026-11-08): `publish`
            // answers LISTING_INACTIVE_BY_STAFF, so promising "edit it and
            // publish again" would hand the seller a 403.
            body: `Reason: ${why}. It is hidden from the marketplace and only an administrator can make it visible again. Edit it if something needs fixing, then contact support to have it reviewed.`,
            data: {
              listingId: row.id,
              listingTitle: row.title,
              reason: why,
              action,
              expiresAt: row.expiresAt?.toISOString() ?? null,
            },
          };

    try {
      await this.notifications.notify({ userId: row.userId, ...notice });
    } catch (error) {
      this.logger.warn(
        `Moderation notice for listing ${row.id} failed: ${String(error)}`,
      );
    }
  }
}
