import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, type DbClient } from '../db/drizzle.provider';
import { userLoginDevices } from '../db/schema/login-devices.schema';
import { NotificationsService } from '../notifications/notifications.service';
import type { ClientDeviceInfo } from './client-device.decorator';

const UNKNOWN_DEVICE_NAME = 'Unknown device';
/** The list's title fallback; the mock shows a bare "Unknown". */
const UNKNOWN_DEVICE_LABEL = 'Unknown';
const DEVICE_NAME_MAX_LENGTH = 120;
const MAX_ACTIVE_DEVICES = 100;

export interface RecordLoginResult {
  /** True only when this login came from a new, non-first device. */
  isNewDevice: boolean;
  /** The row's revocation epoch; null when nothing was written. */
  sessionId: string | null;
}

/** Which row the caller is on: JWT `sid` first, legacy device id second. */
export interface CurrentDeviceRef {
  sessionId: string | null;
  deviceId: string | null;
}

export interface LoginDeviceView {
  id: string;
  name: string;
  clientType: 'browser' | 'app' | null;
  clientVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isCurrent: boolean;
}

export interface RevokeResult {
  revoked: number;
}

/**
 * Registry of the devices an account has logged in from, the device list the
 * settings page renders, and the session-revocation anchor.
 *
 * `sessionId` is the revocation epoch: tokens carry it as `sid`, and revoking a
 * device rotates it so every token minted before the revoke stops matching.
 * It is deliberately not rotated on login, so a re-login on the same browser
 * reuses the row's current value (concurrent tabs cannot invalidate each
 * other) and only a revoke kills the old tokens.
 *
 * The first device an account ever records is a silent baseline: alerting on
 * it would fire for every existing user when this ships and for every new
 * signup. Every later unseen device alerts once; repeats just refresh
 * `lastSeenAt` and metadata.
 *
 * Nothing here may fail a login. DB failures are logged and reported as "not
 * a new device"; a notification write failure still reports the device as new
 * so the dialog shows, because the login really is from a new device.
 */
@Injectable()
export class LoginDevicesService {
  private readonly logger = new Logger(LoginDevicesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Records the login and returns the session id tokens should carry plus
   * whether the caller should show the "new device" dialog. Never throws.
   */
  async recordLogin(
    userId: string,
    device: ClientDeviceInfo | null,
  ): Promise<RecordLoginResult> {
    if (!device) return { isNewDevice: false, sessionId: null };

    const suppliedName =
      device.name?.trim().slice(0, DEVICE_NAME_MAX_LENGTH) || null;
    const displayName = suppliedName ?? UNKNOWN_DEVICE_NAME;
    const sessionId = randomUUID();
    const metadata = this.metadata(device);

    try {
      const [inserted] = await this.db
        .insert(userLoginDevices)
        .values({
          userId,
          deviceId: device.id,
          deviceName: suppliedName,
          sessionId,
          ...metadata,
        })
        .onConflictDoNothing({
          target: [userLoginDevices.userId, userLoginDevices.deviceId],
        })
        .returning({ id: userLoginDevices.id });

      if (!inserted) {
        // Known device, or a concurrent login won the insert race. Refresh
        // the row; keep the existing session id (only a revoke rotates it) and
        // clear a previous revoke so a logged-out browser can sign in again.
        const [row] = await this.db
          .update(userLoginDevices)
          .set({
            lastSeenAt: new Date(),
            revokedAt: null,
            ...(suppliedName ? { deviceName: suppliedName } : {}),
            ...metadata,
          })
          .where(
            and(
              eq(userLoginDevices.userId, userId),
              eq(userLoginDevices.deviceId, device.id),
            ),
          )
          .returning({ sessionId: userLoginDevices.sessionId });

        return {
          isNewDevice: false,
          sessionId: row?.sessionId ?? null,
        };
      }

      // The row just inserted is included, so a count of 1 means this is the
      // account's first recorded device — the silent baseline.
      let firstDevice = true;
      try {
        const [row] = await this.db
          .select({ value: count() })
          .from(userLoginDevices)
          .where(eq(userLoginDevices.userId, userId));
        firstDevice = Number(row?.value ?? 0) <= 1;
      } catch (err) {
        // The row is written; treat a failed count as "not a new device"
        // rather than discarding the session id.
        this.logger.warn(
          `Could not count login devices for user ${userId}: ${this.describeError(err)}`,
        );
      }

      if (firstDevice) return { isNewDevice: false, sessionId };

      try {
        await this.notifications.notify({
          userId,
          type: 'security.new_login',
          title: 'New device login',
          body: `${displayName} signed in to your account. If this wasn't you, change your password in Settings.`,
          data: {
            deviceId: device.id,
            deviceName: displayName,
            loggedInAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        // The device is still new — the dialog should show — but the durable
        // feed row is missing. Log and carry on.
        this.logger.warn(
          `Could not create the new-device notification for user ${userId}: ${this.describeError(err)}`,
        );
      }

      return { isNewDevice: true, sessionId };
    } catch (err) {
      this.logger.warn(
        `Could not record the login device for user ${userId}: ${this.describeError(err)}`,
      );
      return { isNewDevice: false, sessionId: null };
    }
  }

  /** Active rows, newest last-seen first. Also touches the current row. */
  async listActive(
    userId: string,
    current: CurrentDeviceRef,
  ): Promise<LoginDeviceView[]> {
    const currentId = await this.resolveCurrentRowId(userId, current);

    if (currentId) {
      try {
        await this.touchById(userId, currentId);
      } catch (err) {
        this.logger.warn(
          `Could not touch login device ${currentId}: ${this.describeError(err)}`,
        );
      }
    }

    const rows = await this.db
      .select({
        id: userLoginDevices.id,
        deviceName: userLoginDevices.deviceName,
        clientType: userLoginDevices.clientType,
        clientVersion: userLoginDevices.clientVersion,
        browserName: userLoginDevices.browserName,
        browserVersion: userLoginDevices.browserVersion,
        osName: userLoginDevices.osName,
        osVersion: userLoginDevices.osVersion,
        deviceModel: userLoginDevices.deviceModel,
        firstSeenAt: userLoginDevices.firstSeenAt,
        lastSeenAt: userLoginDevices.lastSeenAt,
      })
      .from(userLoginDevices)
      .where(
        and(
          eq(userLoginDevices.userId, userId),
          isNull(userLoginDevices.revokedAt),
        ),
      )
      .orderBy(desc(userLoginDevices.lastSeenAt))
      .limit(MAX_ACTIVE_DEVICES);

    return rows.map((row) => ({
      id: row.id,
      name: row.deviceName ?? UNKNOWN_DEVICE_LABEL,
      clientType:
        row.clientType === 'browser' || row.clientType === 'app'
          ? row.clientType
          : null,
      clientVersion: row.clientVersion,
      browserName: row.browserName,
      browserVersion: row.browserVersion,
      osName: row.osName,
      osVersion: row.osVersion,
      deviceModel: row.deviceModel,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      isCurrent: row.id === currentId,
    }));
  }

  /** Owner-scoped revoke; the current row is refused. Idempotent. */
  async revoke(
    userId: string,
    id: string,
    current: CurrentDeviceRef,
  ): Promise<RevokeResult> {
    const [target] = await this.db
      .select({
        id: userLoginDevices.id,
        revokedAt: userLoginDevices.revokedAt,
      })
      .from(userLoginDevices)
      .where(
        and(eq(userLoginDevices.id, id), eq(userLoginDevices.userId, userId)),
      )
      .limit(1);

    if (!target) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found.',
      });
    }

    const currentId = await this.resolveCurrentRowId(userId, current);
    if (target.id === currentId) {
      throw new ConflictException({
        code: 'CANNOT_REVOKE_CURRENT_DEVICE',
        message: 'This is your current device. Use sign out instead.',
      });
    }

    if (target.revokedAt) return { revoked: 0 };

    const revoked = await this.revokeWhere(
      and(
        eq(userLoginDevices.userId, userId),
        eq(userLoginDevices.id, id),
        isNull(userLoginDevices.revokedAt),
      ),
    );
    return { revoked };
  }

  /** Revoke every active row except the caller's current one. */
  async revokeOthers(
    userId: string,
    current: CurrentDeviceRef,
  ): Promise<RevokeResult> {
    const currentId = await this.resolveCurrentRowId(userId, current);
    if (!currentId) {
      throw new BadRequestException({
        code: 'NO_ACTIVE_SESSION',
        message: 'Sign in again to manage your devices.',
      });
    }

    const revoked = await this.revokeWhere(
      and(
        eq(userLoginDevices.userId, userId),
        isNull(userLoginDevices.revokedAt),
        ne(userLoginDevices.id, currentId),
      ),
    );
    return { revoked };
  }

  /** Logout: revoke the caller's session. Idempotent and never throws. */
  async revokeSession(
    userId: string,
    sessionId: string | null,
  ): Promise<RevokeResult> {
    if (!sessionId) return { revoked: 0 };
    try {
      const revoked = await this.revokeWhere(
        and(
          eq(userLoginDevices.userId, userId),
          eq(userLoginDevices.sessionId, sessionId),
          isNull(userLoginDevices.revokedAt),
        ),
      );
      return { revoked };
    } catch (err) {
      this.logger.warn(
        `Could not revoke the session for user ${userId}: ${this.describeError(err)}`,
      );
      return { revoked: 0 };
    }
  }

  /**
   * The active row behind a legacy (no-`sid`) refresh token, if any. The
   * `revokedAt` value is returned so the caller can distinguish "no device"
   * (grandfather) from "this device was revoked" (reject).
   */
  async findSessionByDeviceId(
    userId: string,
    deviceId: string,
  ): Promise<{ sessionId: string; revokedAt: Date | null } | null> {
    const [row] = await this.db
      .select({
        sessionId: userLoginDevices.sessionId,
        revokedAt: userLoginDevices.revokedAt,
      })
      .from(userLoginDevices)
      .where(
        and(
          eq(userLoginDevices.userId, userId),
          eq(userLoginDevices.deviceId, deviceId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Refresh heartbeat: true only when the session is still active. */
  async touchActiveSession(
    userId: string,
    sessionId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .update(userLoginDevices)
      .set({ lastSeenAt: new Date() })
      .where(
        and(
          eq(userLoginDevices.userId, userId),
          eq(userLoginDevices.sessionId, sessionId),
          isNull(userLoginDevices.revokedAt),
        ),
      )
      .returning({ id: userLoginDevices.id });
    return rows.length > 0;
  }

  /** Connect-time check for the chat WebSocket. */
  async isSessionActive(userId: string, sessionId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userLoginDevices.id })
      .from(userLoginDevices)
      .where(
        and(
          eq(userLoginDevices.userId, userId),
          eq(userLoginDevices.sessionId, sessionId),
          isNull(userLoginDevices.revokedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  private metadata(device: ClientDeviceInfo) {
    return {
      ...(device.type ? { clientType: device.type } : {}),
      ...(device.browserName ? { browserName: device.browserName } : {}),
      ...(device.browserVersion
        ? { browserVersion: device.browserVersion }
        : {}),
      ...(device.osName ? { osName: device.osName } : {}),
      ...(device.osVersion ? { osVersion: device.osVersion } : {}),
      ...(device.model ? { deviceModel: device.model } : {}),
      ...(device.clientVersion ? { clientVersion: device.clientVersion } : {}),
      ...(device.userAgent ? { userAgent: device.userAgent } : {}),
    };
  }

  private async resolveCurrentRowId(
    userId: string,
    current: CurrentDeviceRef,
  ): Promise<string | null> {
    if (current.sessionId) {
      const [row] = await this.db
        .select({ id: userLoginDevices.id })
        .from(userLoginDevices)
        .where(
          and(
            eq(userLoginDevices.userId, userId),
            eq(userLoginDevices.sessionId, current.sessionId),
            isNull(userLoginDevices.revokedAt),
          ),
        )
        .limit(1);
      if (row) return row.id;
    }

    if (current.deviceId) {
      const [row] = await this.db
        .select({ id: userLoginDevices.id })
        .from(userLoginDevices)
        .where(
          and(
            eq(userLoginDevices.userId, userId),
            eq(userLoginDevices.deviceId, current.deviceId),
            isNull(userLoginDevices.revokedAt),
          ),
        )
        .limit(1);
      if (row) return row.id;
    }

    return null;
  }

  private async touchById(userId: string, id: string): Promise<void> {
    await this.db
      .update(userLoginDevices)
      .set({ lastSeenAt: new Date() })
      .where(
        and(
          eq(userLoginDevices.userId, userId),
          eq(userLoginDevices.id, id),
          isNull(userLoginDevices.revokedAt),
        ),
      );
  }

  /**
   * Revokes every matching row and rotates each row's session id so even a
   * cached token that somehow skipped the revocation check cannot match.
   * `gen_random_uuid()` is evaluated per row, keeping the unique index happy.
   */
  private async revokeWhere(where: SQL | undefined): Promise<number> {
    const rows = await this.db
      .update(userLoginDevices)
      .set({
        revokedAt: new Date(),
        sessionId: sql`gen_random_uuid()`,
      })
      .where(where)
      .returning({ id: userLoginDevices.id });
    return rows.length;
  }

  private describeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
