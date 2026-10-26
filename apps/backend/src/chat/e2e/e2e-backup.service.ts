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
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, gt, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import {
  e2eBackupSegments,
  e2eBackups,
  e2eHistoryRequests,
  userE2eDevices,
} from '../../db/schema/chat.schema';
import type { BackupKdfParams, E2eHeader } from '../../db/schema/chat.schema';
import { ChatPubSubService } from '../chat-pubsub.service';
import { E2E_PUSH } from './e2e-push-events';
import type { E2ePushType } from './e2e-push-events';
import type {
  AddBackupSegmentDto,
  ApproveHistoryRequestDto,
  InitBackupDto,
  ListBackupSegmentsDto,
  SetBackupPasscodeDto,
} from './dto/backup.dto';

/**
 * keyProof is itself high-entropy (an HMAC under the 256-bit BK), so a plain
 * sha256 is enough — no slow hash needed, nothing to brute-force.
 */
export function hashKeyProof(keyProof: string): string {
  return createHash('sha256').update(keyProof, 'utf8').digest('hex');
}

/** Wrong passcodes allowed before the backup locks. */
export const PASSCODE_MAX_ATTEMPTS = 5;
/** First lock length; doubles with every further wrong attempt. */
const PASSCODE_BASE_LOCK_MINUTES = 60;
const HISTORY_REQUEST_TTL_DAYS = 7;
const SEGMENT_PAGE_SIZE = 20;

export interface BackupStatus {
  exists: boolean;
  keyCheck: string | null;
  hasPasscode: boolean;
  passcodeSalt: string | null;
  passcodeParams: BackupKdfParams | null;
  lockedUntil: Date | null;
}

export interface HistoryRequestView {
  id: string;
  requesterDeviceId: string;
  requesterLabel: string | null;
  status: string;
  approverDeviceId: string | null;
  header: E2eHeader | null;
  wrappedKey: string | null;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Server side of the encrypted chat-history backup. Everything stored here
 * is ciphertext under a backup key (BK) the server never sees; this service
 * only enforces ownership, the passcode attempt limit, and the approval
 * handshake's state machine. See tasks/plan-e2e-multi-device.md.
 */
@Injectable()
export class E2eBackupService {
  private readonly logger = new Logger(E2eBackupService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly pubsub: ChatPubSubService,
  ) {}

  /**
   * Tell the user's open tabs something changed (ids only, see
   * `e2e-push-events.ts`). Runs after the write has committed and never throws:
   * the client's safety poll covers a lost hint, and a failed hint must not
   * turn a successful write into an error.
   */
  private async push(
    userId: string,
    type: E2ePushType,
    data: Record<string, string>,
  ): Promise<void> {
    try {
      await this.pubsub.publish({
        targetUserId: userId,
        type: 'notification',
        payload: { type, data },
      });
    } catch (err) {
      this.logger.warn(
        `Push of ${type} to ${userId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getStatus(userId: string): Promise<BackupStatus> {
    const [row] = await this.db
      .select()
      .from(e2eBackups)
      .where(eq(e2eBackups.userId, userId))
      .limit(1);
    return {
      exists: Boolean(row),
      keyCheck: row?.keyCheck ?? null,
      hasPasscode: Boolean(row?.wrappedKey && row.passcodeAuthHash),
      passcodeSalt: row?.passcodeSalt ?? null,
      passcodeParams: row?.passcodeParams ?? null,
      lockedUntil:
        row?.lockedUntil && row.lockedUntil > new Date()
          ? row.lockedUntil
          : null,
    };
  }

  /**
   * First device to get here defines the account's BK (by its keyCheck).
   * Concurrent first devices race on the PK: the loser gets created=false
   * and must obtain the winner's BK (passcode or approval) instead.
   */
  async init(
    userId: string,
    dto: InitBackupDto,
  ): Promise<BackupStatus & { created: boolean }> {
    await this.assertOwnDevice(userId, dto.deviceId);
    const inserted = await this.db
      .insert(e2eBackups)
      .values({
        userId,
        keyCheck: dto.keyCheck,
        keyProofHash: hashKeyProof(dto.keyProof),
      })
      .onConflictDoNothing({ target: e2eBackups.userId })
      .returning({ userId: e2eBackups.userId });
    return { ...(await this.getStatus(userId)), created: inserted.length > 0 };
  }

  async setPasscode(
    userId: string,
    dto: SetBackupPasscodeDto,
  ): Promise<{ ok: true }> {
    const authHash = await bcrypt.hash(dto.authKey, 10);
    const proofHash = hashKeyProof(dto.keyProof);
    // One guarded UPDATE: keyCheck says "right account backup", the proof
    // says "caller actually holds BK" — keyCheck alone is public (getStatus),
    // so without the proof any JWT holder could overwrite the passcode wrap
    // and lock the owner out of passcode restore.
    //
    // A null keyProofHash (row created before proofs existed) adopts the
    // first proof presented. Only pre-proof rows are exposed to that, and
    // this feature never shipped without it outside dev databases.
    const updated = await this.db
      .update(e2eBackups)
      .set({
        passcodeSalt: dto.salt,
        passcodeParams: dto.params,
        wrappedKey: dto.wrappedKey,
        passcodeAuthHash: authHash,
        keyProofHash: proofHash,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(e2eBackups.userId, userId),
          eq(e2eBackups.keyCheck, dto.keyCheck),
          or(
            eq(e2eBackups.keyProofHash, proofHash),
            isNull(e2eBackups.keyProofHash),
          ),
        ),
      )
      .returning({ userId: e2eBackups.userId });
    if (updated.length === 0)
      throw new ConflictException({
        code: 'E2E_BACKUP_KEY_MISMATCH',
        message: "This device's backup key is not the account's current one",
      });
    return { ok: true };
  }

  /**
   * Releases the passcode-wrapped BK to a caller proving the passcode.
   *
   * The attempt is counted BEFORE comparing, in one atomic UPDATE that also
   * refuses while locked — so firing many guesses in parallel can't slip
   * past the limit between a check and an increment.
   */
  async unlock(
    userId: string,
    authKey: string,
  ): Promise<{ wrappedKey: string }> {
    const [row] = await this.db
      .update(e2eBackups)
      .set({ failedAttempts: sql`${e2eBackups.failedAttempts} + 1` })
      .where(
        and(
          eq(e2eBackups.userId, userId),
          sql`${e2eBackups.passcodeAuthHash} is not null`,
          or(
            isNull(e2eBackups.lockedUntil),
            lt(e2eBackups.lockedUntil, sql`now()`),
          ),
        ),
      )
      .returning();

    if (!row) {
      const status = await this.getStatus(userId);
      if (!status.hasPasscode)
        throw new NotFoundException({
          code: 'E2E_NO_PASSCODE',
          message: 'No backup passcode is set for this account',
        });
      throw new HttpException(
        {
          code: 'E2E_PASSCODE_LOCKED',
          message: 'Too many wrong passcodes — try again later',
          details: { lockedUntil: status.lockedUntil },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ok = await bcrypt.compare(authKey, row.passcodeAuthHash!);
    if (ok) {
      await this.db
        .update(e2eBackups)
        .set({ failedAttempts: 0, lockedUntil: null })
        .where(eq(e2eBackups.userId, userId));
      return { wrappedKey: row.wrappedKey! };
    }

    const attempts = row.failedAttempts; // already incremented
    let lockedUntil: Date | null = null;
    if (attempts >= PASSCODE_MAX_ATTEMPTS) {
      const minutes =
        PASSCODE_BASE_LOCK_MINUTES *
        2 ** Math.min(attempts - PASSCODE_MAX_ATTEMPTS, 10);
      lockedUntil = new Date(Date.now() + minutes * 60_000);
      await this.db
        .update(e2eBackups)
        .set({ lockedUntil })
        .where(eq(e2eBackups.userId, userId));
    }
    throw new BadRequestException({
      code: 'E2E_PASSCODE_WRONG',
      message: 'Wrong passcode',
      details: {
        attemptsLeft: Math.max(0, PASSCODE_MAX_ATTEMPTS - attempts),
        lockedUntil,
      },
    });
  }

  private async assertOwnDevice(
    userId: string,
    deviceId: string,
  ): Promise<void> {
    const [device] = await this.db
      .select({ id: userE2eDevices.id })
      .from(userE2eDevices)
      .where(
        and(
          eq(userE2eDevices.id, deviceId),
          eq(userE2eDevices.userId, userId),
          isNull(userE2eDevices.revokedAt),
        ),
      )
      .limit(1);
    if (!device) throw new NotFoundException('Device not active');
  }

  async addSegment(
    userId: string,
    dto: AddBackupSegmentDto,
  ): Promise<{ id: string }> {
    await this.assertOwnDevice(userId, dto.deviceId);
    const [row] = await this.db
      .insert(e2eBackupSegments)
      .values({
        userId,
        deviceId: dto.deviceId,
        ciphertext: dto.ciphertext,
        messageCount: dto.messageCount,
      })
      .returning({ id: e2eBackupSegments.id });
    void this.push(userId, E2E_PUSH.backupUpdated, { deviceId: dto.deviceId });
    return row;
  }

  async listSegments(
    userId: string,
    dto: ListBackupSegmentsDto,
  ): Promise<{
    items: { id: string; ciphertext: string; messageCount: number }[];
    nextCursor: string | null;
    /**
     * Position after the last returned segment (or the input cursor on an
     * empty page) — devices persist it to pull only NEW segments later.
     */
    latestCursor: string | null;
  }> {
    await this.assertOwnDevice(userId, dto.deviceId);
    const cursor = dto.cursor;
    const decoded = cursor ? this.decodeCursor(cursor) : null;
    const rows = await this.db
      .select()
      .from(e2eBackupSegments)
      .where(
        and(
          eq(e2eBackupSegments.userId, userId),
          decoded
            ? or(
                gt(e2eBackupSegments.createdAt, decoded.createdAt),
                and(
                  eq(e2eBackupSegments.createdAt, decoded.createdAt),
                  gt(e2eBackupSegments.id, decoded.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(e2eBackupSegments.createdAt), asc(e2eBackupSegments.id))
      .limit(SEGMENT_PAGE_SIZE + 1);

    const page = rows.slice(0, SEGMENT_PAGE_SIZE);
    const last = page[page.length - 1];
    const lastCursor = last
      ? Buffer.from(
          JSON.stringify({ createdAt: last.createdAt, id: last.id }),
        ).toString('base64')
      : null;
    return {
      items: page.map((r) => ({
        id: r.id,
        ciphertext: r.ciphertext,
        messageCount: r.messageCount,
      })),
      nextCursor: rows.length > SEGMENT_PAGE_SIZE ? lastCursor : null,
      latestCursor: lastCursor ?? (decoded ? cursor! : null),
    };
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf8'),
      ) as { createdAt?: string; id?: string };
      if (
        !parsed.createdAt ||
        !parsed.id ||
        !/^[0-9a-f-]{36}$/i.test(parsed.id)
      )
        return null;
      const createdAt = new Date(parsed.createdAt);
      return Number.isNaN(createdAt.getTime())
        ? null
        : { createdAt, id: parsed.id };
    } catch {
      return null;
    }
  }

  // ── Approval by an existing device ───────────────────────────────────────

  private readonly requestView = {
    id: e2eHistoryRequests.id,
    requesterDeviceId: e2eHistoryRequests.requesterDeviceId,
    requesterLabel: userE2eDevices.label,
    status: e2eHistoryRequests.status,
    approverDeviceId: e2eHistoryRequests.approverDeviceId,
    header: e2eHistoryRequests.header,
    wrappedKey: e2eHistoryRequests.wrappedKey,
    createdAt: e2eHistoryRequests.createdAt,
    expiresAt: e2eHistoryRequests.expiresAt,
  };

  private async expireStale(userId: string): Promise<void> {
    await this.db
      .update(e2eHistoryRequests)
      .set({ status: 'expired' })
      .where(
        and(
          eq(e2eHistoryRequests.userId, userId),
          eq(e2eHistoryRequests.status, 'pending'),
          lt(e2eHistoryRequests.expiresAt, sql`now()`),
        ),
      );
  }

  /** Open (or return the already-open) request for this device. Idempotent. */
  async createHistoryRequest(
    userId: string,
    deviceId: string,
  ): Promise<HistoryRequestView> {
    await this.assertOwnDevice(userId, deviceId);
    await this.expireStale(userId);
    const inserted = await this.db
      .insert(e2eHistoryRequests)
      .values({
        userId,
        requesterDeviceId: deviceId,
        expiresAt: sql`now() + make_interval(days => ${HISTORY_REQUEST_TTL_DAYS})`,
      })
      .onConflictDoNothing()
      .returning({ id: e2eHistoryRequests.id });
    // Only a new request is news; the call is idempotent for an open one.
    if (inserted.length > 0)
      void this.push(userId, E2E_PUSH.historyRequested, {
        requestId: inserted[0].id,
        requesterDeviceId: deviceId,
      });
    const mine = await this.getMine(userId, deviceId);
    return mine!;
  }

  /** Latest request this device made (any status) — the requester polls this. */
  async getMine(
    userId: string,
    deviceId: string,
  ): Promise<HistoryRequestView | null> {
    await this.expireStale(userId);
    const [row] = await this.db
      .select(this.requestView)
      .from(e2eHistoryRequests)
      .innerJoin(
        userE2eDevices,
        eq(userE2eDevices.id, e2eHistoryRequests.requesterDeviceId),
      )
      .where(
        and(
          eq(e2eHistoryRequests.userId, userId),
          eq(e2eHistoryRequests.requesterDeviceId, deviceId),
        ),
      )
      .orderBy(desc(e2eHistoryRequests.createdAt))
      .limit(1);
    return row ?? null;
  }

  /** Requests from the account's OTHER devices, for an approver to act on. */
  async listPending(
    userId: string,
    deviceId: string,
  ): Promise<HistoryRequestView[]> {
    await this.expireStale(userId);
    return this.db
      .select(this.requestView)
      .from(e2eHistoryRequests)
      .innerJoin(
        userE2eDevices,
        eq(userE2eDevices.id, e2eHistoryRequests.requesterDeviceId),
      )
      .where(
        and(
          eq(e2eHistoryRequests.userId, userId),
          eq(e2eHistoryRequests.status, 'pending'),
          ne(e2eHistoryRequests.requesterDeviceId, deviceId),
          isNull(userE2eDevices.revokedAt),
        ),
      )
      .orderBy(asc(e2eHistoryRequests.createdAt));
  }

  async approve(
    userId: string,
    requestId: string,
    dto: ApproveHistoryRequestDto,
  ): Promise<{ ok: true }> {
    await this.assertOwnDevice(userId, dto.approverDeviceId);
    const updated = await this.db
      .update(e2eHistoryRequests)
      .set({
        status: 'approved',
        approverDeviceId: dto.approverDeviceId,
        header: dto.header,
        wrappedKey: dto.wrappedKey,
        respondedAt: sql`now()`,
      })
      .where(
        and(
          eq(e2eHistoryRequests.id, requestId),
          eq(e2eHistoryRequests.userId, userId),
          eq(e2eHistoryRequests.status, 'pending'),
          ne(e2eHistoryRequests.requesterDeviceId, dto.approverDeviceId),
          gt(e2eHistoryRequests.expiresAt, sql`now()`),
        ),
      )
      .returning({
        id: e2eHistoryRequests.id,
        requesterDeviceId: e2eHistoryRequests.requesterDeviceId,
      });
    if (updated.length === 0)
      throw new ConflictException({
        code: 'E2E_REQUEST_NOT_PENDING',
        message: 'This request was already handled or has expired',
      });
    void this.push(userId, E2E_PUSH.historyResolved, {
      requestId: updated[0].id,
      requesterDeviceId: updated[0].requesterDeviceId,
      status: 'approved',
    });
    return { ok: true };
  }

  async decline(
    userId: string,
    requestId: string,
    approverDeviceId: string,
  ): Promise<{ ok: true }> {
    await this.assertOwnDevice(userId, approverDeviceId);
    const declined = await this.db
      .update(e2eHistoryRequests)
      .set({
        status: 'declined',
        approverDeviceId,
        respondedAt: sql`now()`,
      })
      .where(
        and(
          eq(e2eHistoryRequests.id, requestId),
          eq(e2eHistoryRequests.userId, userId),
          eq(e2eHistoryRequests.status, 'pending'),
          ne(e2eHistoryRequests.requesterDeviceId, approverDeviceId),
          gt(e2eHistoryRequests.expiresAt, sql`now()`),
        ),
      )
      .returning({
        id: e2eHistoryRequests.id,
        requesterDeviceId: e2eHistoryRequests.requesterDeviceId,
      });
    // Declining something already handled is a silent no-op, so say nothing.
    if (declined.length > 0)
      void this.push(userId, E2E_PUSH.historyResolved, {
        requestId: declined[0].id,
        requesterDeviceId: declined[0].requesterDeviceId,
        status: 'declined',
      });
    return { ok: true };
  }

  /** Requester has unwrapped BK — drop the wrapped copy from the server. */
  async consume(
    userId: string,
    requestId: string,
    deviceId: string,
  ): Promise<{ ok: true }> {
    await this.assertOwnDevice(userId, deviceId);
    // One conditional UPDATE: only the requesting device can consume, and only
    // while the request is still approved. A replay (or a request answered on
    // another device) must not report success.
    const consumed = await this.db
      .update(e2eHistoryRequests)
      .set({ status: 'consumed', header: null, wrappedKey: null })
      .where(
        and(
          eq(e2eHistoryRequests.id, requestId),
          eq(e2eHistoryRequests.userId, userId),
          eq(e2eHistoryRequests.requesterDeviceId, deviceId),
          eq(e2eHistoryRequests.status, 'approved'),
        ),
      )
      .returning({ id: e2eHistoryRequests.id });
    if (consumed.length > 0) return { ok: true };

    // Nothing matched. Only tell this device about requests it made itself —
    // for any other id the answer is indistinguishable from "no such request".
    const [existing] = await this.db
      .select({ requesterDeviceId: e2eHistoryRequests.requesterDeviceId })
      .from(e2eHistoryRequests)
      .where(
        and(
          eq(e2eHistoryRequests.id, requestId),
          eq(e2eHistoryRequests.userId, userId),
        ),
      )
      .limit(1);
    if (existing && existing.requesterDeviceId === deviceId)
      throw new ConflictException({
        code: 'E2E_REQUEST_NOT_PENDING',
        message: 'This request was already handled or has expired',
      });
    throw new NotFoundException({
      code: 'E2E_REQUEST_NOT_FOUND',
      message: 'No such history request for this device',
    });
  }
}
