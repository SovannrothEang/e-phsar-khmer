import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { users } from '../db/schema/users.schema';
import { listings } from '../db/schema/listings.schema';
import {
  listingReports,
  reportReasons,
  userReports,
} from '../db/schema/reports.schema';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { NotificationPayload } from '../notifications/notification-channel.interface';
import type {
  CreateListingReportDto,
  CreateUserReportDto,
} from './dto/create-report.dto';

/**
 * The user side of reporting: read the admin-managed reasons, file a report
 * against a listing or an account. Review happens in the admin module
 * (`src/admin/reports/`), which is where approval takes its action.
 */
@Injectable()
export class UserReportsService {
  private readonly logger = new Logger(UserReportsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
  ) {}

  listReasons(targetType: 'user' | 'listing') {
    return this.db
      .select({ id: reportReasons.id, reason: reportReasons.reason })
      .from(reportReasons)
      .where(
        and(
          eq(reportReasons.targetType, targetType),
          eq(reportReasons.isActive, true),
        ),
      )
      .orderBy(asc(reportReasons.sortOrder), asc(reportReasons.reason));
  }

  async reportListing(reporterId: string, dto: CreateListingReportDto) {
    const [listing] = await this.db
      .select({ userId: listings.userId, moderatedAt: listings.moderatedAt })
      .from(listings)
      .where(eq(listings.id, dto.listingId))
      .limit(1);
    if (!listing || listing.moderatedAt) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.userId === reporterId) {
      throw new BadRequestException('CANNOT_REPORT_OWN_LISTING');
    }
    const reason = await this.assertReason(dto.reasonId, 'listing');

    const report = await this.insertOnce(() =>
      this.db
        .insert(listingReports)
        .values({
          reporterId,
          listingId: dto.listingId,
          reasonId: dto.reasonId,
          description: dto.description?.trim() || null,
        })
        .returning({ id: listingReports.id }),
    );

    await this.notifyStaffOfReport({
      type: 'report.created',
      title: 'New listing report',
      body: `Reason: ${reason}. A new listing report is waiting in the admin queue.`,
      data: {
        reportId: report.id,
        targetType: 'listing',
        targetId: dto.listingId,
        reason,
      },
    });
    return report;
  }

  async reportUser(reporterId: string, dto: CreateUserReportDto) {
    if (dto.targetUserId === reporterId) {
      throw new BadRequestException('CANNOT_REPORT_SELF');
    }
    const [target] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, dto.targetUserId), isNull(users.deletedAt)))
      .limit(1);
    if (!target) throw new NotFoundException('User not found');
    const reason = await this.assertReason(dto.reasonId, 'user');
    const imagePaths = dto.imagePaths ?? [];
    for (const path of imagePaths) {
      // Only the reporter's own uploads — the admin page renders these, so a
      // foreign path would let a report display someone else's image.
      if (
        !this.files.isOwnedPath(path, reporterId) ||
        !path.startsWith(`report/${reporterId}/`)
      ) {
        throw new BadRequestException('INVALID_IMAGE');
      }
    }

    const report = await this.insertOnce(() =>
      this.db
        .insert(userReports)
        .values({
          reporterId,
          targetUserId: dto.targetUserId,
          reasonId: dto.reasonId,
          description: dto.description?.trim() || null,
          imagePaths,
        })
        .returning({ id: userReports.id }),
    );

    await this.notifyStaffOfReport({
      type: 'report.created',
      title: 'New account report',
      body: `Reason: ${reason}. A new account report is waiting in the admin queue.`,
      data: {
        reportId: report.id,
        targetType: 'user',
        targetId: dto.targetUserId,
        reason,
      },
    });
    return report;
  }

  private async assertReason(
    id: string,
    targetType: 'user' | 'listing',
  ): Promise<string> {
    const [row] = await this.db
      .select({ reason: reportReasons.reason })
      .from(reportReasons)
      .where(
        and(
          eq(reportReasons.id, id),
          eq(reportReasons.targetType, targetType),
          eq(reportReasons.isActive, true),
        ),
      )
      .limit(1);
    if (!row) throw new BadRequestException('INVALID_REASON');
    return row.reason;
  }

  /**
   * Staff audit signal after the report row commits. Best-effort: retrying the
   * POST would only file a duplicate, so a notice failure is logged, never
   * surfaced. The reporter's identity is deliberately absent from the payload.
   */
  private async notifyStaffOfReport(
    payload: Omit<NotificationPayload, 'userId'>,
  ): Promise<void> {
    try {
      await this.notifications.notifyStaff(payload);
    } catch (err) {
      this.logger.warn(
        `Could not notify staff of report ${String(payload.data?.reportId)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * The pending-report partial unique index is the dedupe: a second report
   * while the first is still open is a 409, not a second queue row.
   */
  private async insertOnce(
    insert: () => Promise<Array<{ id: string }>>,
  ): Promise<{ id: string }> {
    try {
      const [row] = await insert();
      return row;
    } catch (err) {
      if (
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: unknown }).code === '23505'
      ) {
        throw new ConflictException('ALREADY_REPORTED');
      }
      throw err;
    }
  }
}
