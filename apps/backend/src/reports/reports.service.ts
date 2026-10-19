import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { listings } from '../db/schema/listings.schema';
import {
  listingReports,
  reportReasons,
  userReports,
} from '../db/schema/reports.schema';
import { users } from '../db/schema/users.schema';
import type { CreateReportDto } from './dto/create-report.dto';

export interface ReportReasonOption {
  id: string;
  reason: string;
}

export interface CreatedReport {
  id: string;
  targetType: 'user' | 'listing';
  targetId: string;
  status: 'pending';
  createdAt: Date;
}

/**
 * The customer-facing half of moderation: reading the reason picklist and
 * filing a report. Admin review lives in `src/admin/reports/`.
 *
 * Filing is deliberately separate from the admin module — the admin controller
 * is role-gated at the class level and must stay that way.
 */
@Injectable()
export class ReportSubmissionService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /** Active picklist for one target type, in display order. */
  listReasons(targetType: 'user' | 'listing'): Promise<ReportReasonOption[]> {
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

  async create(
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<CreatedReport> {
    await this.assertTarget(reporterId, dto);
    await this.assertReason(dto);
    this.assertImagePaths(reporterId, dto.imagePaths);

    const description = dto.description?.trim() || null;
    const imagePaths = dto.imagePaths ?? [];

    if (dto.targetType === 'listing') {
      await this.assertNotPending({
        reporterId,
        targetId: dto.targetId,
        targetType: 'listing',
      });
      const [row] = await this.db
        .insert(listingReports)
        .values({
          reporterId,
          listingId: dto.targetId,
          reasonId: dto.reasonId,
          description,
          imagePaths,
        })
        .returning({
          id: listingReports.id,
          createdAt: listingReports.createdAt,
        });
      return {
        id: row.id,
        targetType: 'listing',
        targetId: dto.targetId,
        status: 'pending',
        createdAt: row.createdAt,
      };
    }

    await this.assertNotPending({
      reporterId,
      targetId: dto.targetId,
      targetType: 'user',
    });
    const [row] = await this.db
      .insert(userReports)
      .values({
        reporterId,
        targetUserId: dto.targetId,
        reasonId: dto.reasonId,
        description,
        imagePaths,
      })
      .returning({
        id: userReports.id,
        createdAt: userReports.createdAt,
      });
    return {
      id: row.id,
      targetType: 'user',
      targetId: dto.targetId,
      status: 'pending',
      createdAt: row.createdAt,
    };
  }

  private async assertTarget(
    reporterId: string,
    dto: CreateReportDto,
  ): Promise<void> {
    if (dto.targetType === 'listing') {
      const [target] = await this.db
        .select({ id: listings.id, userId: listings.userId })
        .from(listings)
        .where(eq(listings.id, dto.targetId))
        .limit(1);
      if (!target) {
        throw new NotFoundException({
          code: 'TARGET_NOT_FOUND',
          message: 'Listing not found',
        });
      }
      if (target.userId === reporterId) {
        throw new BadRequestException({
          code: 'CANNOT_REPORT_SELF',
          message: 'You cannot report your own listing',
        });
      }
      return;
    }

    const [target] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, dto.targetId), isNull(users.deletedAt)))
      .limit(1);
    if (!target) {
      throw new NotFoundException({
        code: 'TARGET_NOT_FOUND',
        message: 'User not found',
      });
    }
    if (target.id === reporterId) {
      throw new BadRequestException({
        code: 'CANNOT_REPORT_SELF',
        message: 'You cannot report your own account',
      });
    }
  }

  /** The reason must exist, be active, and belong to the same target type. */
  private async assertReason(dto: CreateReportDto): Promise<void> {
    const [reason] = await this.db
      .select({ id: reportReasons.id })
      .from(reportReasons)
      .where(
        and(
          eq(reportReasons.id, dto.reasonId),
          eq(reportReasons.targetType, dto.targetType),
          eq(reportReasons.isActive, true),
        ),
      )
      .limit(1);
    if (!reason) {
      throw new BadRequestException({
        code: 'INVALID_REASON',
        message: 'Unknown reason for this report type',
      });
    }
  }

  /**
   * One pending report per reporter→target. A rejected report does not block
   * a new one ("it is still up, here is more evidence" is a real flow), so
   * the check is pending-only. Check-then-insert: a concurrent identical
   * submit can duplicate, which is queue noise rather than a correctness
   * failure — a partial unique index would also break the re-report flow.
   */
  private async assertNotPending(input: {
    reporterId: string;
    targetId: string;
    targetType: 'user' | 'listing';
  }): Promise<void> {
    const [pending] =
      input.targetType === 'listing'
        ? await this.db
            .select({ id: listingReports.id })
            .from(listingReports)
            .where(
              and(
                eq(listingReports.reporterId, input.reporterId),
                eq(listingReports.listingId, input.targetId),
                eq(listingReports.status, 'pending'),
              ),
            )
            .limit(1)
        : await this.db
            .select({ id: userReports.id })
            .from(userReports)
            .where(
              and(
                eq(userReports.reporterId, input.reporterId),
                eq(userReports.targetUserId, input.targetId),
                eq(userReports.status, 'pending'),
              ),
            )
            .limit(1);

    if (pending) {
      throw new ConflictException({
        code: 'REPORT_ALREADY_PENDING',
        message: 'You already have a pending report for this target',
        details: { id: pending.id },
      });
    }
  }

  /**
   * Evidence must live under the reporter's own upload namespace. Mirrors the
   * chat-image ownership rule; without it a reporter could attach (and point
   * the admin at) another user's objects.
   */
  private assertImagePaths(reporterId: string, paths?: string[]): void {
    if (!paths?.length) return;
    const prefix = `report/${reporterId}/`;
    for (const path of paths) {
      const hasDots = path.split('/').some((s) => s === '.' || s === '..');
      if (!path.startsWith(prefix) || hasDots) {
        throw new BadRequestException({
          code: 'INVALID_IMAGE_PATH',
          message: 'Evidence images must be uploaded by the reporter',
        });
      }
    }
  }
}
