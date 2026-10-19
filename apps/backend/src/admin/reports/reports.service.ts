import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { users, userPhones } from '../../db/schema/users.schema';
import { listings } from '../../db/schema/listings.schema';
import {
  bannedPhones,
  reportReasons,
  userReports,
  listingReports,
} from '../../db/schema/reports.schema';
import type {
  ReportReasonRow,
  UserReportRow,
  ListingReportRow,
} from '../../db/schema/reports.schema';
import { normalizePhoneE164 } from '../../reports/phone-ban.util';
import type {
  CreateReportReasonDto,
  UpdateReportReasonDto,
  UpdateReportStatusDto,
} from './dto/report.dto';

function nameOf(u: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string {
  return (
    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || '—'
  );
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  // ── Reasons ───────────────────────────────────────────────
  listReasons(targetType?: 'user' | 'listing'): Promise<ReportReasonRow[]> {
    return this.db
      .select()
      .from(reportReasons)
      .where(targetType ? eq(reportReasons.targetType, targetType) : undefined)
      .orderBy(asc(reportReasons.sortOrder));
  }

  async createReason(dto: CreateReportReasonDto): Promise<ReportReasonRow> {
    try {
      const [row] = await this.db
        .insert(reportReasons)
        .values({ targetType: dto.targetType, reason: dto.reason })
        .returning();
      return row;
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('Reason already exists for that type');
      }
      throw err;
    }
  }

  async updateReason(
    id: string,
    dto: UpdateReportReasonDto,
  ): Promise<ReportReasonRow> {
    const rows = await this.db
      .update(reportReasons)
      .set(dto.reason ? { reason: dto.reason } : {})
      .where(eq(reportReasons.id, id))
      .returning();
    if (!rows.length) throw new NotFoundException('Reason not found');
    return rows[0];
  }

  async removeReason(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .select({ id: reportReasons.id })
      .from(reportReasons)
      .where(eq(reportReasons.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Reason not found');
    await this.db.delete(reportReasons).where(eq(reportReasons.id, id));
    return { id };
  }

  // ── User reports ──────────────────────────────────────────
  async listUserReports(): Promise<
    Array<
      UserReportRow & {
        reporterName: string;
        targetName: string;
        targetUsername: string | null;
        reviewerName: string | null;
        reasonText: string | null;
      }
    >
  > {
    const rows = await this.db
      .select({
        report: userReports,
        reason: reportReasons,
      })
      .from(userReports)
      .leftJoin(reportReasons, eq(reportReasons.id, userReports.reasonId))
      .orderBy(desc(userReports.createdAt));

    const userIds = [
      ...new Set(
        rows.flatMap((r) =>
          [
            r.report.reporterId,
            r.report.targetUserId,
            r.report.reviewedById,
          ].filter((id): id is string => id !== null),
        ),
      ),
    ];
    const allUsers =
      userIds.length > 0
        ? await this.db.select().from(users).where(inArray(users.id, userIds))
        : [];
    const nameMap = new Map(allUsers.map((u) => [u.id, nameOf(u)]));
    const usernameMap = new Map(allUsers.map((u) => [u.id, u.username]));

    return rows.map((r) => ({
      ...r.report,
      reporterName: nameMap.get(r.report.reporterId) ?? '—',
      targetName: nameMap.get(r.report.targetUserId) ?? '—',
      targetUsername: usernameMap.get(r.report.targetUserId) ?? null,
      reviewerName: r.report.reviewedById
        ? (nameMap.get(r.report.reviewedById) ?? '—')
        : null,
      reasonText: r.reason?.reason ?? null,
    }));
  }

  /**
   * Approving a user report takes the account down AND bans every phone
   * number on it from ever registering again. The account's listings are
   * removed in the same transaction — a suspended seller's ads must not stay
   * in the marketplace. Both take-down markers matter: `status` hides them
   * from lists, `taken_down_at` 404s the public detail route and blocks
   * `publish`. All of it commits with the verdict, so a report cannot read
   * `approved` while the account or its ads are still live.
   *
   * The ban is keyed on the number, not the account, so it survives the
   * account's eventual hard purge. Rejecting an already-approved report only
   * rewrites the verdict — v1 bans and take-downs are permanent.
   */
  async updateUserReportStatus(
    id: string,
    dto: UpdateReportStatusDto,
    reviewerId: string,
  ): Promise<UserReportRow> {
    const [report] = await this.db
      .select()
      .from(userReports)
      .where(eq(userReports.id, id))
      .limit(1);
    if (!report) throw new NotFoundException('User report not found');

    if (dto.status !== 'approved') {
      const [row] = await this.db
        .update(userReports)
        .set({ status: dto.status, reviewedById: reviewerId })
        .where(eq(userReports.id, id))
        .returning();
      return row;
    }

    const updated = await this.db.transaction(async (tx) => {
      // Never resurrect or re-mark an account an admin already deleted.
      await tx
        .update(users)
        .set({ status: 'suspended', updatedAt: new Date() })
        .where(
          and(eq(users.id, report.targetUserId), ne(users.status, 'deleted')),
        );

      // Take down every live listing the account owns. Already owner-deleted
      // rows are left alone (there is no restore path, and re-marking them
      // would only churn `updated_at`).
      await tx
        .update(listings)
        .set({
          status: 'deleted',
          takenDownAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(listings.userId, report.targetUserId),
            ne(listings.status, 'deleted'),
            isNull(listings.takenDownAt),
          ),
        );

      const [target] = await tx
        .select({ primaryPhone: users.primaryPhone })
        .from(users)
        .where(eq(users.id, report.targetUserId))
        .limit(1);
      const extraPhones = await tx
        .select({ phone: userPhones.phone })
        .from(userPhones)
        .where(eq(userPhones.userId, report.targetUserId));

      const phones = [
        ...new Set(
          [target?.primaryPhone, ...extraPhones.map((p) => p.phone)]
            .filter((phone): phone is string => phone !== null)
            .map(normalizePhoneE164),
        ),
      ];
      if (phones.length > 0) {
        await tx
          .insert(bannedPhones)
          .values(
            phones.map((phone) => ({
              phone,
              userId: report.targetUserId,
              reportId: report.id,
              bannedById: reviewerId,
            })),
          )
          // A number already banned by an earlier report stays banned.
          .onConflictDoNothing({ target: bannedPhones.phone });
      }

      return tx
        .update(userReports)
        .set({ status: 'approved', reviewedById: reviewerId })
        .where(eq(userReports.id, id))
        .returning();
    });

    return updated[0];
  }

  async removeUserReport(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .select({ id: userReports.id })
      .from(userReports)
      .where(eq(userReports.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('User report not found');
    await this.db.delete(userReports).where(eq(userReports.id, id));
    return { id };
  }

  // ── Listing reports ───────────────────────────────────────
  async listListingReports(): Promise<
    Array<
      ListingReportRow & {
        reporterName: string;
        listingTitle: string | null;
        listingOwnerName: string | null;
        listingOwnerUsername: string | null;
        reviewerName: string | null;
        reasonText: string | null;
      }
    >
  > {
    const rows = await this.db
      .select({
        report: listingReports,
        listing: listings,
        reason: reportReasons,
      })
      .from(listingReports)
      .leftJoin(listings, eq(listings.id, listingReports.listingId))
      .leftJoin(reportReasons, eq(reportReasons.id, listingReports.reasonId))
      .orderBy(desc(listingReports.createdAt));

    const userIds = [
      ...new Set(
        rows.flatMap((r) =>
          [
            r.report.reporterId,
            r.report.reviewedById,
            r.listing?.userId,
          ].filter((id): id is string => id !== null && id !== undefined),
        ),
      ),
    ];
    const allUsers =
      userIds.length > 0
        ? await this.db.select().from(users).where(inArray(users.id, userIds))
        : [];
    const nameMap = new Map(allUsers.map((u) => [u.id, nameOf(u)]));
    const usernameMap = new Map(allUsers.map((u) => [u.id, u.username]));

    return rows.map((r) => ({
      ...r.report,
      reporterName: nameMap.get(r.report.reporterId) ?? '—',
      listingTitle: r.listing?.title ?? null,
      listingOwnerName: r.listing?.userId
        ? (nameMap.get(r.listing.userId) ?? null)
        : null,
      listingOwnerUsername: r.listing?.userId
        ? (usernameMap.get(r.listing.userId) ?? null)
        : null,
      reviewerName: r.report.reviewedById
        ? (nameMap.get(r.report.reviewedById) ?? '—')
        : null,
      reasonText: r.reason?.reason ?? null,
    }));
  }

  /**
   * Approving a listing report takes the listing down: `status='deleted'`
   * hides it from every list, `taken_down_at` keeps it hidden from the direct
   * detail URL and blocks the owner's `publish` resurrection. Verdict and
   * take-down commit together; rejecting later never restores the listing.
   */
  async updateListingReportStatus(
    id: string,
    dto: UpdateReportStatusDto,
    reviewerId: string,
  ): Promise<ListingReportRow> {
    const [report] = await this.db
      .select()
      .from(listingReports)
      .where(eq(listingReports.id, id))
      .limit(1);
    if (!report) throw new NotFoundException('Listing report not found');

    if (dto.status !== 'approved') {
      const [row] = await this.db
        .update(listingReports)
        .set({ status: dto.status, reviewedById: reviewerId })
        .where(eq(listingReports.id, id))
        .returning();
      return row;
    }

    const updated = await this.db.transaction(async (tx) => {
      await tx
        .update(listings)
        .set({
          status: 'deleted',
          takenDownAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(listings.id, report.listingId));

      return tx
        .update(listingReports)
        .set({ status: 'approved', reviewedById: reviewerId })
        .where(eq(listingReports.id, id))
        .returning();
    });

    return updated[0];
  }

  async removeListingReport(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .select({ id: listingReports.id })
      .from(listingReports)
      .where(eq(listingReports.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Listing report not found');
    await this.db.delete(listingReports).where(eq(listingReports.id, id));
    return { id };
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    );
  }
}
