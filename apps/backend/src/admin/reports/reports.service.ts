import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
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
import type { RequestUser } from '../../common/types/api-response.types';
import { ListingsService } from '../../listings/listings.service';
import { AdminService } from '../admin.service';
import { AdminListingsService } from '../admin-listings.service';
import { FilesService } from '../../files/files.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SettingsService } from '../../settings/settings.service';
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
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly listingsService: ListingsService,
    private readonly adminService: AdminService,
    private readonly files: FilesService,
    private readonly adminListings: AdminListingsService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

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
        imageUrls: string[];
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
      // imagePaths are storage paths; the dashboard needs URLs to render.
      imageUrls: r.report.imagePaths.map((p) => this.files.publicUrlFor(p)),
    }));
  }

  /**
   * Approving a user report suspends the reported account, in the same
   * transaction and under the same account rules as editing it directly (a
   * plain admin cannot suspend staff). Moving an approved report back to
   * rejected/pending does NOT reinstate the account — that is an explicit
   * status change on the Users page.
   *
   * The approval no longer bans the account's phone numbers: suspension is
   * the consequence, and it is the outcome an admin can lift. `banned_phones`
   * still blocks registration, it simply has no writer on this path.
   */
  async updateUserReportStatus(
    id: string,
    dto: UpdateReportStatusDto,
    reviewer: RequestUser,
  ) {
    const { updated, approvedNow, targetUserId } = await this.db.transaction(
      async (tx) => {
        const [found] = await tx
          .select({ report: userReports, reason: reportReasons.reason })
          .from(userReports)
          .leftJoin(reportReasons, eq(reportReasons.id, userReports.reasonId))
          .where(eq(userReports.id, id))
          .limit(1)
          .for('update', { of: userReports });
        if (!found) throw new NotFoundException('User report not found');
        const { report } = found;

        const [row] = await tx
          .update(userReports)
          .set({ status: dto.status, reviewedById: reviewer.id })
          .where(eq(userReports.id, id))
          .returning();

        const isApproval =
          dto.status === 'approved' && report.status !== 'approved';
        if (isApproval) {
          await this.adminService.authorizeManage(
            tx,
            reviewer,
            report.targetUserId,
            { status: 'suspended' },
          );
          await this.adminService.suspendAccount(
            tx,
            report.targetUserId,
            found.reason ? `Reported: ${found.reason}` : 'Reported account',
            reviewer.id,
          );

          // Every other open report against this account is settled by the
          // same decision.
          await tx
            .update(userReports)
            .set({ status: 'approved', reviewedById: reviewer.id })
            .where(
              and(
                eq(userReports.targetUserId, report.targetUserId),
                eq(userReports.status, 'pending'),
              ),
            );
        }
        return {
          updated: row,
          approvedNow: isApproval,
          targetUserId: report.targetUserId,
        };
      },
    );

    if (approvedNow) {
      await this.adminService.announceSuspension(targetUserId);
      await this.alertIfThresholdReached(targetUserId);
    }
    return updated;
  }

  /**
   * The account's approved-report count — account reports plus approved
   * reports on the ads it owns — against the configured threshold.
   *
   * This is a triage signal and nothing else: it notifies staff and returns.
   * Suspending, hiding or deleting stays a human decision, so a coordinated
   * group can never get an account punished by filing reports.
   *
   * Best-effort by design: the approval has already committed, and a notice
   * that could not be delivered must not turn a correct decision into a 500.
   */
  private async alertIfThresholdReached(targetUserId: string): Promise<void> {
    try {
      const [[accountReports], [postReports], threshold] = await Promise.all([
        this.db
          .select({ value: count() })
          .from(userReports)
          .where(
            and(
              eq(userReports.targetUserId, targetUserId),
              eq(userReports.status, 'approved'),
            ),
          ),
        this.db
          .select({ value: count() })
          .from(listingReports)
          .innerJoin(listings, eq(listings.id, listingReports.listingId))
          .where(
            and(
              eq(listings.userId, targetUserId),
              eq(listingReports.status, 'approved'),
            ),
          ),
        this.settings.suspensionThreshold(),
      ]);

      const approved = (accountReports?.value ?? 0) + (postReports?.value ?? 0);
      if (approved < threshold) return;

      await this.notifications.notifyStaff({
        type: 'report.threshold',
        title: 'Account reached the report threshold',
        body: `${approved} approved reports (threshold ${threshold}). Review the account on the Users page.`,
        data: { targetUserId, approvedReports: approved, threshold },
      });
    } catch (err) {
      this.logger.warn(
        `Could not alert staff about reports for ${targetUserId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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

  /**
   * Approving a listing report takes the listing down (ListingsService
   * .moderate) in the same transaction. As with user reports, un-approving
   * does not restore it — restoring is an explicit action on the admin
   * Listings page.
   *
   * The owner notice is emitted only after the transaction resolves: the
   * notification is not part of the DB write, so a rollback must not leave a
   * notice behind for a take-down that never happened. A listing that was
   * already moderated (the Listings page is the other take-down path) gets no
   * second notice; the prior state is read under the same report lock.
   */
  async updateListingReportStatus(
    id: string,
    dto: UpdateReportStatusDto,
    reviewer: RequestUser,
  ) {
    const { row, notice } = await this.db.transaction(async (tx) => {
      const [found] = await tx
        .select({
          report: listingReports,
          reason: reportReasons.reason,
          listingModeratedAt: listings.moderatedAt,
        })
        .from(listingReports)
        .leftJoin(reportReasons, eq(reportReasons.id, listingReports.reasonId))
        .leftJoin(listings, eq(listings.id, listingReports.listingId))
        .where(eq(listingReports.id, id))
        .limit(1)
        .for('update', { of: listingReports });
      if (!found) throw new NotFoundException('Listing report not found');
      const { report } = found;

      const [updated] = await tx
        .update(listingReports)
        .set({ status: dto.status, reviewedById: reviewer.id })
        .where(eq(listingReports.id, id))
        .returning();

      if (dto.status === 'approved' && report.status !== 'approved') {
        const reason = found.reason
          ? `Reported: ${found.reason}`
          : 'Reported content';
        // A listing removed by the direct route (or an earlier report) keeps
        // its original moderation metadata and its notice: re-running
        // `moderate` would re-date the removal and rewrite the stored reason
        // while the owner still holds the first notice.
        const moderated = found.listingModeratedAt
          ? null
          : await this.listingsService.moderate(
              report.listingId,
              reviewer.id,
              reason,
              tx,
            );
        await tx
          .update(listingReports)
          .set({ status: 'approved', reviewedById: reviewer.id })
          .where(
            and(
              eq(listingReports.listingId, report.listingId),
              eq(listingReports.status, 'pending'),
            ),
          );
        return {
          row: updated,
          notice: moderated ? { listing: moderated, reason } : null,
        };
      }
      return { row: updated, notice: null };
    });

    if (notice) {
      await this.adminListings.notifyOwnerOfModeration(
        notice.listing,
        'removed',
        notice.reason,
      );
    }
    return row;
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
