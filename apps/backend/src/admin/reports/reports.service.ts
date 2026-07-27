import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { users } from '../../db/schema/users.schema';
import { listings } from '../../db/schema/listings.schema';
import {
  reportReasons,
  userReports,
  listingReports,
} from '../../db/schema/reports.schema';
import type {
  ReportReasonRow,
  UserReportRow,
  ListingReportRow,
} from '../../db/schema/reports.schema';
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
        rows.flatMap((r) => [r.report.reporterId, r.report.targetUserId]),
      ),
    ];
    const allUsers =
      userIds.length > 0
        ? await this.db.select().from(users).where(inArray(users.id, userIds))
        : [];
    const nameMap = new Map(allUsers.map((u) => [u.id, nameOf(u)]));

    return rows.map((r) => ({
      ...r.report,
      reporterName: nameMap.get(r.report.reporterId) ?? '—',
      targetName: nameMap.get(r.report.targetUserId) ?? '—',
      reasonText: r.reason?.reason ?? null,
    }));
  }

  async updateUserReportStatus(
    id: string,
    dto: UpdateReportStatusDto,
    reviewerId: string,
  ) {
    const rows = await this.db
      .update(userReports)
      .set({ status: dto.status, reviewedById: reviewerId })
      .where(eq(userReports.id, id))
      .returning();
    if (!rows.length) throw new NotFoundException('User report not found');
    return rows[0];
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

    const reporterIds = [...new Set(rows.map((r) => r.report.reporterId))];
    const allUsers =
      reporterIds.length > 0
        ? await this.db
            .select()
            .from(users)
            .where(inArray(users.id, reporterIds))
        : [];
    const nameMap = new Map(allUsers.map((u) => [u.id, nameOf(u)]));

    return rows.map((r) => ({
      ...r.report,
      reporterName: nameMap.get(r.report.reporterId) ?? '—',
      listingTitle: r.listing?.title ?? null,
      reasonText: r.reason?.reason ?? null,
    }));
  }

  async updateListingReportStatus(
    id: string,
    dto: UpdateReportStatusDto,
    reviewerId: string,
  ) {
    const rows = await this.db
      .update(listingReports)
      .set({ status: dto.status, reviewedById: reviewerId })
      .where(eq(listingReports.id, id))
      .returning();
    if (!rows.length) throw new NotFoundException('Listing report not found');
    return rows[0];
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
