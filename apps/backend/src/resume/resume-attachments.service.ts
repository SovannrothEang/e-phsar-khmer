import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { resumeAttachments, resumes } from '../db/schema/resume.schema';
import type { ResumeAttachmentRow } from '../db/schema/resume.schema';
import { SupabaseService } from '../common/supabase/supabase.service';
import {
  RESUME_ATTACHMENT_DOWNLOAD_TTL_SECONDS,
  RESUME_ATTACHMENT_MAX_BYTES,
  RESUME_ATTACHMENT_ORPHAN_AGE_HOURS,
  RESUME_ATTACHMENT_PENDING_MAX,
  RESUME_ATTACHMENT_UPLOAD_TTL_SECONDS,
} from './resume-attachments.constants';
import type { CreateResumeAttachmentDto } from './dto/attachments.dto';

export interface ResumeAttachmentUploadTicket {
  id: string;
  uploadUrl: string;
  token: string;
  expiresIn: number;
}

export interface ResumeAttachmentDownloadUrl {
  url: string;
  expiresAt: string;
}

/**
 * The CV file's lifecycle — a deliberate mirror of `ChatAttachmentsService`,
 * minus the encryption: create (reserve the object, issue a signed upload URL)
 * → complete (read the **real** size back from storage, then attach it to the
 * resume, replacing any previous CV) → signed download for the owner only →
 * cleanup of uploads that never attached.
 *
 * A CV is personal data, so the object lives in its own private bucket and is
 * never a public URL. No client declaration is trusted: `declaredSize` is only
 * an early rejection, the size that gets stored is the one storage reports.
 */
@Injectable()
export class ResumeAttachmentsService {
  private readonly logger = new Logger(ResumeAttachmentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private get bucket(): string {
    return this.config.get<string>('resume.filesBucket') ?? 'resume-files';
  }

  /** Reserve the object and hand back a signed upload URL. Idempotent per id. */
  async create(
    userId: string,
    dto: CreateResumeAttachmentDto,
  ): Promise<ResumeAttachmentUploadTicket> {
    if (dto.declaredSize > RESUME_ATTACHMENT_MAX_BYTES) throw tooLarge();

    const existing = await this.findById(dto.id);
    if (existing) return this.reissue(userId, existing);

    await this.assertPendingCap(userId);

    const [row] = await this.db
      .insert(resumeAttachments)
      .values({
        id: dto.id,
        userId,
        // The trailing segment is the file name the browser saves down; the
        // rest keeps one user's objects out of another's namespace.
        objectKey: `${userId}/${dto.id}/${safeName(dto.fileName)}`,
        fileName: dto.fileName,
        declaredSize: dto.declaredSize,
      })
      .onConflictDoNothing()
      .returning();
    // Lost a race with a concurrent create of the same id — treat it as the
    // retry it almost certainly is.
    if (!row) {
      const raced = await this.findById(dto.id);
      if (!raced) throw new ConflictException('Attachment create conflict');
      return this.reissue(userId, raced);
    }
    return this.issueUploadUrl(row);
  }

  /**
   * Verify the object exists, trust its size over the client's claim, and
   * attach it — deleting whatever CV it replaces in the same transaction.
   */
  async complete(
    userId: string,
    id: string,
  ): Promise<{ id: string; status: 'attached'; size: number }> {
    const row = await this.findOwned(userId, id);
    // A retried complete must not touch the object again.
    if (row.status === 'attached')
      return { id, status: 'attached', size: row.actualSize ?? 0 };
    if (row.status === 'expired')
      throw new ConflictException({
        code: 'RESUME_ATTACHMENT_EXPIRED',
        message: 'Attachment expired',
      });

    const { data } = await this.supabase.objectInfo(this.bucket, row.objectKey);
    const size = data?.size;
    if (typeof size !== 'number')
      throw new ConflictException({
        code: 'RESUME_ATTACHMENT_NOT_UPLOADED',
        message: 'The file has not been uploaded yet',
      });

    if (size > RESUME_ATTACHMENT_MAX_BYTES) {
      await this.supabase.removeObjects(this.bucket, [row.objectKey]);
      await this.db
        .update(resumeAttachments)
        .set({ status: 'expired', actualSize: size })
        .where(eq(resumeAttachments.id, id));
      throw tooLarge();
    }

    // The resume row must exist before anything can attach to it. Upserted
    // outside the transaction (it is the anchor, not part of the swap) and
    // race-safe by construction.
    const [resume] = await this.db
      .insert(resumes)
      .values({ userId })
      .onConflictDoUpdate({
        target: resumes.userId,
        set: { userId, updatedAt: resumes.updatedAt },
      })
      .returning({ id: resumes.id });
    const resumeId = resume.id;

    const replaced = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(resumeAttachments)
        .set({
          status: 'attached',
          resumeId,
          actualSize: size,
          uploadedAt: sql`now()`,
          attachedAt: sql`now()`,
        })
        .where(
          and(
            eq(resumeAttachments.id, id),
            eq(resumeAttachments.userId, userId),
            eq(resumeAttachments.status, 'pending'),
          ),
        )
        .returning({ id: resumeAttachments.id });
      // Another request completed the same id first: fall through to the
      // stored row instead of double-attaching.
      if (!updated) return null;

      // The swap: one CV per resume. The replaced rows are gone by commit;
      // their objects are removed after it, so a crash here leaks at most one
      // retryable object rather than a dangling reference.
      return tx
        .delete(resumeAttachments)
        .where(
          and(
            eq(resumeAttachments.resumeId, resumeId),
            ne(resumeAttachments.id, id),
          ),
        )
        .returning({ objectKey: resumeAttachments.objectKey });
    });

    if (!replaced) {
      const stored = await this.findOwned(userId, id);
      return { id, status: 'attached', size: stored.actualSize ?? size };
    }
    if (replaced.length > 0)
      await this.supabase.removeObjects(
        this.bucket,
        replaced.map((r) => r.objectKey),
      );

    return { id, status: 'attached', size };
  }

  /**
   * A short-lived download URL for the caller's own attached CV — an empty
   * list when there is none, rather than inventing a URL. Never signs another
   * user's object.
   */
  async sign(userId: string): Promise<ResumeAttachmentDownloadUrl[]> {
    const [row] = await this.db
      .select({ objectKey: resumeAttachments.objectKey })
      .from(resumeAttachments)
      .where(
        and(
          eq(resumeAttachments.userId, userId),
          eq(resumeAttachments.status, 'attached'),
        ),
      )
      .orderBy(desc(resumeAttachments.attachedAt), desc(resumeAttachments.id))
      .limit(1);
    if (!row) return [];

    const { data, error } = await this.supabase.createSignedUrl(
      this.bucket,
      row.objectKey,
      RESUME_ATTACHMENT_DOWNLOAD_TTL_SECONDS,
    );
    if (error || !data) {
      this.logger.warn('Failed to sign resume attachment URL');
      throw new HttpException(
        {
          code: 'RESUME_ATTACHMENT_SIGN_FAILED',
          message: 'Could not sign URL',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    return [
      {
        url: data.signedUrl,
        expiresAt: new Date(
          Date.now() + RESUME_ATTACHMENT_DOWNLOAD_TTL_SECONDS * 1000,
        ).toISOString(),
      },
    ];
  }

  /**
   * A signed URL for **one** attachment id, with no ownership check of its own.
   *
   * Internal by construction: the authorization belongs to the caller, and the
   * only caller is `JobApplicationsService`, which has already proved the
   * viewer is the poster of an application carrying this id. Never wire this to
   * a controller — `sign(userId)` above is the only controller-exposed signing
   * path, and it is owner-only.
   *
   * `null` is the honest answer for an id that no longer resolves: a CV that
   * was removed or replaced has had its row deleted (`complete` swaps rows, not
   * references), and a row whose object has vanished from storage is just as
   * undownloadable. Both mean "this application's CV is gone" — the applicant's
   * live CV is never consulted, so a re-upload cannot silently swap the file
   * under an application the poster already read.
   */
  async signAttachmentById(
    id: string,
  ): Promise<ResumeAttachmentDownloadUrl | null> {
    const [row] = await this.db
      .select({ objectKey: resumeAttachments.objectKey })
      .from(resumeAttachments)
      .where(
        and(
          eq(resumeAttachments.id, id),
          eq(resumeAttachments.status, 'attached'),
        ),
      )
      .limit(1);
    if (!row) return null;

    // The row says "attached", storage has the final word on the object.
    const { data: info } = await this.supabase.objectInfo(
      this.bucket,
      row.objectKey,
    );
    if (typeof info?.size !== 'number') return null;

    const { data, error } = await this.supabase.createSignedUrl(
      this.bucket,
      row.objectKey,
      RESUME_ATTACHMENT_DOWNLOAD_TTL_SECONDS,
    );
    if (error || !data) {
      this.logger.warn('Failed to sign resume attachment URL');
      throw new HttpException(
        {
          code: 'RESUME_ATTACHMENT_SIGN_FAILED',
          message: 'Could not sign URL',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    return {
      url: data.signedUrl,
      expiresAt: new Date(
        Date.now() + RESUME_ATTACHMENT_DOWNLOAD_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }

  /**
   * Removes the caller's own CV: the object after the row is gone in the same
   * statement, never another user's (the `user_id` predicate is the whole
   * guard). Idempotent and deliberately **never 404s** — the end state this
   * promises, "no CV", is already true when there is nothing to delete, the
   * same contract `unlikeListing` and `unfollowUser` keep. Only the attached
   * row is in scope; a pending upload is the orphan sweep's business.
   */
  async deleteAttachment(userId: string): Promise<{ deleted: true }> {
    const removed = await this.db
      .delete(resumeAttachments)
      .where(
        and(
          eq(resumeAttachments.userId, userId),
          eq(resumeAttachments.status, 'attached'),
        ),
      )
      .returning({ objectKey: resumeAttachments.objectKey });

    if (removed.length > 0)
      await this.supabase.removeObjects(
        this.bucket,
        removed.map((r) => r.objectKey),
      );
    return { deleted: true };
  }

  /**
   * Removes storage objects, then rows, for uploads never attached within the
   * orphan window (`resume_id is null` is exactly that state). Safe to rerun:
   * removing a missing object is a no-op. Returns how many rows were removed.
   */
  async cleanupOrphans(batchSize = 100): Promise<number> {
    const rows = await this.db
      .select({
        id: resumeAttachments.id,
        objectKey: resumeAttachments.objectKey,
      })
      .from(resumeAttachments)
      .where(
        and(
          isNull(resumeAttachments.resumeId),
          sql`${resumeAttachments.createdAt} < now() - make_interval(hours => ${RESUME_ATTACHMENT_ORPHAN_AGE_HOURS})`,
        ),
      )
      .limit(batchSize);
    if (rows.length === 0) return 0;

    const { error } = await this.supabase.removeObjects(
      this.bucket,
      rows.map((r) => r.objectKey),
    );
    // Keep the rows when storage refused: deleting them would orphan the
    // objects for good. The next run retries.
    if (error) {
      this.logger.warn('Resume attachment cleanup: storage remove failed');
      return 0;
    }
    await this.db.delete(resumeAttachments).where(
      inArray(
        resumeAttachments.id,
        rows.map((r) => r.id),
      ),
    );
    return rows.length;
  }

  private async findById(id: string): Promise<ResumeAttachmentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(resumeAttachments)
      .where(eq(resumeAttachments.id, id))
      .limit(1);
    return row;
  }

  /** 404 — not 403 — for an id that is not the caller's: no existence oracle. */
  private async findOwned(
    userId: string,
    id: string,
  ): Promise<ResumeAttachmentRow> {
    const row = await this.findById(id);
    if (!row || row.userId !== userId)
      throw new NotFoundException('Attachment not found');
    return row;
  }

  /** Idempotent create: same owner + still pending → a fresh upload URL. */
  private reissue(
    userId: string,
    row: ResumeAttachmentRow,
  ): Promise<ResumeAttachmentUploadTicket> {
    if (row.userId !== userId)
      throw new ConflictException({
        code: 'RESUME_ATTACHMENT_ID_TAKEN',
        message: 'Attachment id already in use',
      });
    if (row.status !== 'pending')
      throw new ConflictException({
        code: 'RESUME_ATTACHMENT_NOT_PENDING',
        message: 'Attachment already uploaded',
        details: { status: row.status },
      });
    return this.issueUploadUrl(row);
  }

  private async issueUploadUrl(
    row: ResumeAttachmentRow,
  ): Promise<ResumeAttachmentUploadTicket> {
    // upsert: a retry after an upload whose response was lost must be able
    // to write the same object again.
    const { data, error } = await this.supabase.createSignedUploadUrl(
      this.bucket,
      row.objectKey,
      { upsert: true },
    );
    if (error || !data)
      throw new HttpException(
        {
          code: 'RESUME_ATTACHMENT_SIGN_FAILED',
          message: 'Could not sign upload',
        },
        HttpStatus.BAD_GATEWAY,
      );
    return {
      id: row.id,
      uploadUrl: data.signedUrl,
      token: data.token,
      expiresIn: RESUME_ATTACHMENT_UPLOAD_TTL_SECONDS,
    };
  }

  /**
   * A reserve-and-abandon loop would otherwise pile up pending rows (and their
   * upload URLs) without bound; the daily-quota idea does not apply here
   * because a CV is 5 MB at most and always replaces the previous one.
   */
  private async assertPendingCap(userId: string): Promise<void> {
    const rows = await this.db
      .select({ id: resumeAttachments.id })
      .from(resumeAttachments)
      .where(
        and(
          eq(resumeAttachments.userId, userId),
          eq(resumeAttachments.status, 'pending'),
        ),
      )
      .limit(RESUME_ATTACHMENT_PENDING_MAX);
    if (rows.length >= RESUME_ATTACHMENT_PENDING_MAX)
      throw new HttpException(
        {
          code: 'RESUME_ATTACHMENT_PENDING_LIMIT',
          message: 'Too many unfinished uploads',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
}

/** The object key's trailing segment: the name the browser saves down. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

function tooLarge(): BadRequestException {
  return new BadRequestException({
    code: 'RESUME_ATTACHMENT_TOO_LARGE',
    message: `File exceeds the ${RESUME_ATTACHMENT_MAX_BYTES / 1024 / 1024} MB limit`,
  });
}
