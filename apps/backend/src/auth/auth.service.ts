import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { and, eq, gt, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import {
  users,
  userAuthProviders,
  userPhones,
} from '../db/schema/users.schema';
import type { UserRow } from '../db/schema/users.schema';
import { SupabaseService } from '../common/supabase/supabase.service';
import type { LoginDto } from './dto/login.dto';
import type { LoginOtpDto } from './dto/login-otp.dto';
import type { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import type { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import type { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import {
  PASSWORD_RESET_TTL_SECONDS,
  PASSWORD_RESET_TYP,
  resetProofStillValid,
} from './password-reset-token';
import type { RegisterDto } from './dto/register.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { SocialLoginDto } from './dto/social-login.dto';
import type { LinkSocialProviderDto } from './dto/link-social-provider.dto';
import {
  buildUsernameBase,
  generateUniqueUsername,
  normalizeUsername,
} from '../users/username.util';
import { isPhoneBanned, normalizePhoneE164 } from '../reports/phone-ban.util';
import { ACCOUNT_RETENTION_DAYS } from '../users/account-purge.service';
import type { ClientDeviceInfo } from './client-device.decorator';
import { LoginDevicesService } from './login-devices.service';
import { LoginLockoutService } from './login-lockout.service';
import { SocialStateService } from './social-state.service';
import { hasActivePaidSubscription } from '../subscriptions/verified-account.util';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpService } from '../otp/otp.service';
import { OtpSmsSender } from '../otp/otp-sms-sender';
import type { OtpSendResult } from '../otp/otp-sms-sender';
import type { OtpPurpose } from '../otp/otp.types';
import { isIssuedBeforeCutoff } from './token-cutoff.util';
import { SettingsService } from '../settings/settings.service';

/** Response of every "send me a code" endpoint. */
export interface OtpRequestResult {
  otpSent: true;
  /** Seconds until the next code may be requested (own OTP provider only). */
  retryAfterSeconds?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/** Mirrors AdminService.createUser bcrypt cost. */
const PASSWORD_SALT_ROUNDS = 10;

/** A `sid` is a row UUID; reject anything else before it reaches Postgres. */
const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What Supabase will accept as a phone; a stored value that fails it is unusable. */
const RESET_PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

/** postgres.js exposes the SQLSTATE on the error object. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

export type PublicUser = Omit<UserRow, 'passwordHash' | 'tokensValidAfter'>;

/** Every successful login path returns this shape. */
export interface AuthResult extends AuthTokens {
  user: PublicUser;
  /** True when this login came from a new, non-first device. */
  newDevice: boolean;
}

export interface TelegramAuthPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly loginDevices: LoginDevicesService,
    private readonly otpService: OtpService,
    private readonly otpSender: OtpSmsSender,
    private readonly notifications: NotificationsService,
    private readonly loginLockout: LoginLockoutService,
    private readonly socialState: SocialStateService,
    // Only for the support contacts carried by the suspension refusal.
    private readonly settings: SettingsService,
  ) {}

  async loginWithPassword(
    dto: LoginDto,
    device: ClientDeviceInfo | null = null,
  ): Promise<AuthResult> {
    // Per-account gate first: the IP buckets cannot separate web users (every
    // web call arrives from Next's server), so a credential-stuffing run
    // against one account is only stopped here.
    await this.loginLockout.assertNotLocked(dto.identifier);

    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          or(
            eq(users.username, dto.identifier),
            // Generated and self-chosen handles are stored lowercased, so
            // "SokDara" must find "sokdara". The exact match above still
            // serves admin-created mixed-case usernames.
            eq(users.username, normalizeUsername(dto.identifier)),
            eq(users.primaryPhone, dto.identifier),
          ),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!user) {
      // No active account matches, but the identifier may belong to one its
      // owner deleted inside the recovery window — signing back in is how
      // they undo that (the settings page promises it, and the account is
      // still intact until AccountPurgeService runs).
      const recoverable = await this.findRecoverable(dto.identifier);
      if (!recoverable?.passwordHash) {
        await this.loginLockout.recordFailure(dto.identifier);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      const matches = await bcrypt.compare(
        dto.password,
        recoverable.passwordHash,
      );
      if (!matches) {
        await this.loginLockout.recordFailure(dto.identifier);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      // A soft-deleted row can ALSO be suspended (self-delete keeps the
      // phone, and staff can suspend such a row). Reviving it would clear a
      // suspension nobody lifted, so the refusal wins.
      await this.assertNotSuspended(recoverable);
      const revived = await this.revive(recoverable.id);
      await this.loginLockout.reset(dto.identifier);
      return this.finishLogin(revived, device);
    }

    if (!user.passwordHash) {
      await this.loginLockout.recordFailure(dto.identifier);
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.loginLockout.recordFailure(dto.identifier);
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }
    // Unreachable while the lookup above filters deleted rows out, but kept as
    // the guard it has always been: it is the only thing between a deleted
    // account and a token if that filter is ever lifted. Recovery goes through
    // findRecoverable() above, which is deliberate about which rows qualify.
    if (user.deletedAt) throw new UnauthorizedException('Account deactivated');
    if (user.status !== 'active') throw await this.suspendedRefusal(user);

    await this.loginLockout.reset(dto.identifier);
    return this.finishLogin(user, device);
  }

  /** `supabase` keeps Supabase SMS; `plasgate` (the default) uses our own OTPs. */
  private get usesOwnOtp(): boolean {
    return this.configService.get<string>('otp.provider') === 'plasgate';
  }

  /**
   * plasgate path: issue + send a code and map the outcome. Never leaks
   * provider text; a cooldown/cap is a 429 the web can show a timer for.
   */
  private async sendOwnOtp(
    phone: string,
    purpose: OtpPurpose,
    ip?: string | null,
  ): Promise<OtpRequestResult> {
    return this.mapOtpSendResult(
      await this.otpSender.issueAndSend(phone, purpose, ip),
    );
  }

  private mapOtpSendResult(result: OtpSendResult): OtpRequestResult {
    switch (result.status) {
      case 'sent':
        return { otpSent: true, retryAfterSeconds: result.retryAfterSeconds };
      case 'cooldown':
        throw new HttpException(
          {
            code: 'OTP_COOLDOWN',
            message: 'Please wait before requesting another code.',
            retryAfterSeconds: result.retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case 'daily_cap':
        throw new HttpException(
          {
            code: 'OTP_DAILY_CAP',
            message: 'Too many codes requested for this number today.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      default:
        throw new ServiceUnavailableException({
          code: 'OTP_SEND_FAILED',
          message: 'We could not send the code. Please try again later.',
        });
    }
  }

  async registerWithPhone(
    dto: RegisterDto,
    ip?: string | null,
  ): Promise<OtpRequestResult> {
    await this.assertPhoneNotBanned(dto.phone);
    if (this.usesOwnOtp) return this.sendOwnOtp(dto.phone, 'register', ip);
    await this.supabaseService.signInWithOtp(dto.phone);
    return { otpSent: true };
  }

  async verifyPhoneOtp(
    dto: VerifyOtpDto,
    device: ClientDeviceInfo | null = null,
  ): Promise<AuthResult> {
    // Moderation ban first: a banned number must not even burn an OTP.
    await this.assertPhoneNotBanned(dto.phone);
    // Password is checked BEFORE the Supabase call so a wrong password
    // never burns an OTP attempt. For an existing user this is a login
    // (password must match); for an absent user this is a registration
    // (the password becomes the account's passwordHash).
    const [existing] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.primaryPhone, dto.phone), isNull(users.deletedAt)))
      .limit(1);

    // A legacy bare account (created before passwords were required) is
    // COMPLETED in place: possessing the OTP proves phone ownership, so the
    // submitted password (and names) become the account's. An account that
    // already has a password must match it — credentials are never replaced
    // through this endpoint.
    const completingBareAccount =
      existing !== undefined && !existing.passwordHash;

    if (existing && existing.passwordHash) {
      const valid = await bcrypt.compare(dto.password, existing.passwordHash);
      if (!valid) throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // Same recovery window as the password path: a deleted account still
    // answers to its phone, so this revives it instead of letting
    // mirrorSupabaseUser create a second account for the same number. The
    // password is still checked BEFORE the Supabase call, so a wrong one
    // never burns an OTP attempt.
    const recoverable = existing ? null : await this.findRecoverable(dto.phone);
    if (recoverable?.passwordHash) {
      const matches = await bcrypt.compare(
        dto.password,
        recoverable.passwordHash,
      );
      if (!matches) throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // Supabase user is only a yes/no proof for the phone provider (spike
    // 0.1), so the plasgate path hands the mirror a stand-in.
    let supabaseUser: { id: string; phone?: string };
    if (this.usesOwnOtp) {
      const verified = await this.otpService.verify(
        dto.phone,
        ['register', 'login'],
        dto.token,
      );
      // Same rule as resetPassword: no distinct body for exhaustion, or an
      // unknown phone (which can never hold a code row) would answer
      // differently from a real one.
      if (verified.status !== 'ok')
        throw new UnauthorizedException('Invalid or expired OTP');
      supabaseUser = { id: 'otp', phone: dto.phone };
    } else {
      const { data, error } = await this.supabaseService.verifyOtp(
        dto.phone,
        dto.token,
      );
      if (error || !data.user)
        throw new UnauthorizedException('Invalid or expired OTP');
      supabaseUser = data.user;
    }

    // This endpoint bypasses loginWithPassword, so it needs its own
    // suspension guard — otherwise a suspended account could mint tokens
    // through the OTP login flow. Checked HERE, after the password and the
    // OTP: asserting it any earlier let anyone who knows a phone number read
    // the moderation reason and learn that the number belongs to an account.
    if (existing) await this.assertAccountActive(existing);
    if (recoverable) await this.assertNotSuspended(recoverable);

    if (recoverable) {
      const revived = await this.revive(recoverable.id);
      // The OTP round trip just proved `dto.phone` — `revived.primaryPhone`
      // (the lookup key for `recoverable`) is that same number.
      await this.stampPhoneVerified(revived.id);
      return this.completeVerifiedLogin(
        { ...revived, phoneVerifiedAt: new Date() },
        device,
        dto.phone,
      );
    }

    if (completingBareAccount) {
      const updateData: Partial<typeof users.$inferInsert> = {
        passwordHash: await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS),
        // Possessing the OTP proves ownership of `dto.phone`, which is
        // `existing.primaryPhone` (the lookup key above) — the same proof
        // `verifyPhoneChangeOtp` stamps on a number change.
        phoneVerifiedAt: new Date(),
        updatedAt: new Date(),
      };
      if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
      if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
      if (existing.username === null) {
        const base = buildUsernameBase(
          dto.firstName ?? existing.firstName,
          dto.lastName ?? existing.lastName,
        );
        if (base !== null) {
          updateData.username = await generateUniqueUsername(this.db, base);
        }
      }

      const [row] = await this.db
        .update(users)
        .set(updateData)
        .where(and(eq(users.id, existing.id), isNull(users.deletedAt)))
        .returning();

      return this.completeVerifiedLogin(row, device, dto.phone);
    }

    // Extras land ONLY in the INSERT values — the conflict path (existing
    // user logging in) must never overwrite password/names/username.
    const insertExtras: Partial<typeof users.$inferInsert> = {};
    if (!existing) {
      insertExtras.passwordHash = await bcrypt.hash(
        dto.password,
        PASSWORD_SALT_ROUNDS,
      );
      if (dto.firstName !== undefined) insertExtras.firstName = dto.firstName;
      if (dto.lastName !== undefined) insertExtras.lastName = dto.lastName;
      const base = buildUsernameBase(dto.firstName, dto.lastName);
      if (base !== null) {
        insertExtras.username = await generateUniqueUsername(this.db, base);
      }
    }

    const user = await this.mirrorSupabaseUser(
      supabaseUser,
      'phone',
      dto.phone,
      insertExtras,
    );
    await this.assertAccountActive(user);
    // Both the fresh-insert and the existing-login branch land here with
    // `user.primaryPhone === dto.phone` (mirrorSupabaseUser resolves the
    // phone-provider row by that number), and the OTP round trip above is
    // what just proved it. Done as its own UPDATE rather than through
    // `mirrorSupabaseUser`'s conflict path: that path's `onConflictDoUpdate`
    // is deliberately locked to `{ updatedAt }` so a replayed login body
    // can never overwrite password/names/username, and this must not widen
    // that lock.
    await this.stampPhoneVerified(user.id);
    return this.completeVerifiedLogin(
      { ...user, phoneVerifiedAt: new Date() },
      device,
      dto.phone,
    );
  }

  /**
   * Finishes a successful OTP verification and records it in the durable
   * notification feed. The notification is best-effort: the caller is
   * already signed in, so a feed failure must not fail the login (the same
   * policy `security.new_login` uses). Only `verifyPhoneOtp` comes through
   * here — `register` and `otp/login` send a code but never consume one.
   */
  private async completeVerifiedLogin(
    user: UserRow,
    device: ClientDeviceInfo | null,
    phone: string,
  ): Promise<AuthResult> {
    const result = await this.finishLogin(user, device);
    try {
      await this.notifications.notify({
        userId: user.id,
        type: 'security.otp_verified',
        title: 'Phone verified',
        body: `Your phone number ${phone} was verified with a one-time code.`,
        data: {
          phone,
          method: 'sms',
          verifiedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Could not create the OTP-verified notification for user ${user.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return result;
  }

  /**
   * Stamps proof of phone ownership — the login/registration OTP chokepoint
   * (`verifyPhoneOtp`) never wrote this before, so most accounts read
   * "Not Verified" (`CLAUDE.md` known gap). Deliberately NOT folded into
   * `mirrorSupabaseUser`'s upsert (see the call sites above) — kept as a
   * small, separate, idempotent UPDATE instead.
   */
  private async stampPhoneVerified(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ phoneVerifiedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async requestPhoneOtp(
    phone: string,
    ip?: string | null,
  ): Promise<OtpRequestResult> {
    await this.assertPhoneNotBanned(phone);
    if (this.usesOwnOtp) {
      // The resend call carries no purpose: an active account means this is
      // a login code, otherwise a registration code (verify accepts both).
      const [active] = await this.db
        .select()
        .from(users)
        .where(and(eq(users.primaryPhone, phone), isNull(users.deletedAt)))
        .limit(1);
      return this.sendOwnOtp(phone, active ? 'login' : 'register', ip);
    }
    await this.supabaseService.signInWithOtp(phone);
    return { otpSent: true };
  }

  async requestLoginOtp(
    dto: LoginOtpDto,
    ip?: string | null,
  ): Promise<OtpRequestResult> {
    await this.loginLockout.assertNotLocked(dto.phone);
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.primaryPhone, dto.phone), isNull(users.deletedAt)))
      .limit(1);

    if (!user || !user.passwordHash) {
      await this.loginLockout.recordFailure(dto.phone);
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.loginLockout.recordFailure(dto.phone);
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // The password is proven; a later SMS ban or provider failure is not a
    // credential failure, so it must not extend this account's lockout.
    await this.loginLockout.reset(dto.phone);

    // After the credential check on purpose: a wrong password still answers
    // 401 with no SMS, so the ban is not an oracle for a number the caller
    // cannot prove they own.
    await this.assertPhoneNotBanned(dto.phone);

    if (this.usesOwnOtp) return this.sendOwnOtp(dto.phone, 'login', ip);
    await this.supabaseService.signInWithOtp(dto.phone);
    return { otpSent: true };
  }

  /**
   * Forgot-password step 1: text a code to the phone registered on the
   * account. The answer is ALWAYS `{ otpSent: true }` — whether the
   * identifier matches anything is exactly what a reset form must not
   * reveal. Only the account's own phone is ever texted, so this cannot be
   * used to pump SMS at arbitrary numbers.
   */
  async requestPasswordReset(
    dto: RequestPasswordResetDto,
    ip?: string | null,
  ): Promise<{ otpSent: true }> {
    // A global config fault is not an existence oracle: answer every caller
    // the same 503 instead of the usual "code sent" for a code that can never
    // leave the building.
    if (this.usesOwnOtp && !this.otpSender.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OTP_PROVIDER_UNAVAILABLE',
        message:
          'Password reset is temporarily unavailable. Please try again later.',
      });
    }
    const target = await this.resolveResetTarget(dto.identifier);
    if (target) {
      try {
        // `devBypass: false` on both providers: the reset flow never honours
        // DEV_OTP_TOKEN, even in development, so the feature always exercises
        // the real provider and a production deploy cannot inherit a
        // test-only path.
        if (this.usesOwnOtp) {
          // The own-OTP path stores a hashed, single-use code and sends it
          // detached, so PlasGate latency/failure cannot distinguish a real
          // account from an unknown identifier. Limiter outcomes are
          // swallowed too: the answer is always `{ otpSent: true }`.
          await this.otpSender.issueAndSendDetached(
            target.phone,
            'password_reset',
            ip,
            { devBypass: false },
          );
        } else {
          await this.supabaseService.signInWithOtp(target.phone, {
            devBypass: false,
          });
        }
      } catch (err) {
        // Swallowed on purpose: a failure here must not tell the caller the
        // account exists. Never log the identifier or the phone.
        this.logger.warn(
          `Password-reset OTP send failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return { otpSent: true };
  }

  /**
   * Forgot-password step 2: verify the SMS code and hand back a short-lived
   * proof for the password step. Supabase OTPs are single-use, so the code is
   * consumed here — the password is set by `confirmPasswordReset`.
   */
  async verifyResetCode(dto: VerifyResetCodeDto): Promise<{
    resetToken: string;
    /** The account the code proved control of, shown on the password step. */
    account: { username: string | null; phone: string; email: string | null };
  }> {
    // The reset code is a credential: a locked identifier must not be able to
    // grind codes here either, and an unknown identifier locks the same way.
    await this.loginLockout.assertNotLocked(dto.identifier);

    const target = await this.resolveResetTarget(dto.identifier);
    if (!target) {
      await this.loginLockout.recordFailure(dto.identifier);
      throw this.invalidResetOtp();
    }

    if (this.usesOwnOtp) {
      // Same rule as the request step: the real code only, never
      // DEV_OTP_TOKEN. Every failure (wrong, expired, reused, exhausted) is
      // the same 401, so attempt exhaustion is not an existence oracle.
      const verified = await this.otpService.verify(
        target.phone,
        'password_reset',
        dto.token,
        { devBypass: false },
      );
      if (verified.status !== 'ok') {
        await this.loginLockout.recordFailure(dto.identifier);
        throw this.invalidResetOtp();
      }
    } else {
      const { data, error } = await this.supabaseService.verifyOtp(
        target.phone,
        dto.token,
        // Never accept the dev token on the reset path.
        { devBypass: false },
      );
      if (error || !data.user) {
        await this.loginLockout.recordFailure(dto.identifier);
        throw this.invalidResetOtp();
      }
    }

    await this.loginLockout.reset(dto.identifier);
    const resetToken = this.jwtService.sign(
      { sub: target.userId, typ: PASSWORD_RESET_TYP },
      { expiresIn: PASSWORD_RESET_TTL_SECONDS },
    );
    return {
      resetToken,
      account: {
        username: target.username,
        phone: target.phone,
        email: target.email,
      },
    };
  }

  /**
   * Forgot-password step 3: the proof from `verifyResetCode` buys one
   * password change. The password and the session revoke are one transaction
   * — a half-applied reset would leave old sessions alive against a changed
   * password.
   */
  async confirmPasswordReset(
    dto: ConfirmPasswordResetDto,
  ): Promise<{ reset: true }> {
    const payload = await this.verifyResetToken(dto.resetToken);
    if (!payload) throw this.invalidResetSession();

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      PASSWORD_SALT_ROUNDS,
    );
    const changedAt = new Date();

    const updated = await this.db.transaction(async (tx) => {
      // A reset proof buys exactly one password change. Every change stamps
      // `tokensValidAfter`, so a proof minted before that stamp is dead —
      // otherwise a stolen token could change the password again inside its
      // 10-minute TTL. Read first for a clear failure, then repeat the bound
      // inside the UPDATE so two concurrent confirms cannot both win.
      const [current] = await tx
        .select({ tokensValidAfter: users.tokensValidAfter })
        .from(users)
        .where(
          and(
            eq(users.id, payload.sub),
            eq(users.status, 'active'),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);
      if (
        !current ||
        !resetProofStillValid(payload.issuedAt, current.tokensValidAfter)
      ) {
        return null;
      }

      const [row] = await tx
        .update(users)
        .set({
          passwordHash,
          // Covers tokens minted before this reset, including legacy tokens
          // with no `sid` — the device-row revoke below only reaches sid-bound
          // sessions.
          tokensValidAfter: changedAt,
          updatedAt: changedAt,
        })
        .where(
          and(
            eq(users.id, payload.sub),
            eq(users.status, 'active'),
            isNull(users.deletedAt),
            or(
              isNull(users.tokensValidAfter),
              lte(users.tokensValidAfter, payload.issuedAt),
            ),
          ),
        )
        .returning({ id: users.id });
      if (row) await this.loginDevices.revokeAll(payload.sub, tx);
      return row ?? null;
    });
    // A concurrent delete/suspend or a second use of the same proof must not
    // report a successful reset.
    if (!updated) throw this.invalidResetSession();

    // Best-effort, like every other security notification: the password is
    // already changed, so a feed failure must not fail the reset.
    try {
      await this.notifications.notify({
        userId: updated.id,
        type: 'security.password_changed',
        title: 'Password changed',
        body: "Your password was reset and you were signed out everywhere. If this wasn't you, contact support.",
        data: { changedAt: changedAt.toISOString() },
      });
    } catch (err) {
      this.logger.warn(
        `Could not create the password-changed notification for user ${updated.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { reset: true };
  }

  /** Validates the proof minted by `verifyResetCode`; null on any failure. */
  private async verifyResetToken(
    token: string,
  ): Promise<{ sub: string; issuedAt: Date } | null> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        typ?: unknown;
        iat?: unknown;
      }>(token);
      if (
        payload.typ !== PASSWORD_RESET_TYP ||
        typeof payload.sub !== 'string' ||
        typeof payload.iat !== 'number'
      ) {
        return null;
      }
      return { sub: payload.sub, issuedAt: new Date(payload.iat * 1000) };
    } catch {
      // Expired, tampered with, or signed with another key.
      return null;
    }
  }

  /**
   * The account a reset may act on: active, not deleted, with a usable phone
   * and not banned. The E.164 phone is what Supabase must receive — rows are
   * stored as submitted, so older/admin ones may lack the `+`.
   */
  private async resolveResetTarget(rawIdentifier: string): Promise<{
    userId: string;
    phone: string;
    username: string | null;
    email: string | null;
  } | null> {
    const identifier = rawIdentifier.trim();
    if (identifier.length === 0) return null;

    // The old form accepted spaces/dashes in phone numbers; the column stores
    // the bare digits.
    const phoneCandidate = /^[+\d][\d\s-]{5,}$/.test(identifier)
      ? identifier.replace(/[\s-]/g, '')
      : identifier;

    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          or(
            eq(users.username, identifier),
            eq(users.username, normalizeUsername(identifier)),
            eq(users.primaryPhone, identifier),
            eq(users.primaryPhone, phoneCandidate),
            // Case-insensitive email; the identifier is bound as a parameter.
            sql`lower(${users.email}) = ${identifier.toLowerCase()}`,
          ),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!user || user.status !== 'active' || !user.primaryPhone) return null;

    const phone = normalizePhoneE164(user.primaryPhone.replace(/[\s-]/g, ''));
    if (!RESET_PHONE_PATTERN.test(phone)) return null;
    if (await isPhoneBanned(this.db, phone)) return null;

    return {
      userId: user.id,
      phone,
      username: user.username,
      email: user.email,
    };
  }

  private invalidResetOtp(): UnauthorizedException {
    return new UnauthorizedException('INVALID_OR_EXPIRED_OTP');
  }

  private invalidResetSession(): UnauthorizedException {
    return new UnauthorizedException('INVALID_RESET_TOKEN');
  }

  async getSocialAuthUrl(
    provider: string,
    redirectTo?: string,
  ): Promise<{ url: string; state: string }> {
    if (provider !== 'google' && provider !== 'facebook')
      throw new BadRequestException('UNSUPPORTED_PROVIDER');

    const safeRedirect = this.resolveSocialRedirectTo(redirectTo);
    // Minted before the provider round trip so the callback can prove it
    // belongs to a flow this service started (see SocialStateService).
    const state = await this.socialState.issue(provider);
    const { data, error } = await this.supabaseService.signInWithOAuth(
      provider,
      safeRedirect,
    );
    if (error || !data.url)
      throw new UnauthorizedException('Failed to get social auth URL');
    return { url: data.url, state };
  }

  /**
   * The URL route is public, so `redirectTo` is attacker-controlled until
   * proven otherwise: only our own frontend origins may receive the OAuth
   * tokens. When FRONTEND_ORIGINS is configured it is an exact-origin match;
   * when it is not, development only loops back to localhost and production
   * fails closed. Supabase's redirect allow-list is the second line of
   * defence, never the only one.
   */
  private resolveSocialRedirectTo(redirectTo?: string): string | undefined {
    if (!redirectTo) return undefined;

    let url: URL;
    try {
      url = new URL(redirectTo);
    } catch {
      throw new BadRequestException('INVALID_REDIRECT_URI');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new BadRequestException('INVALID_REDIRECT_URI');
    if (url.username || url.password || url.hash)
      throw new BadRequestException('INVALID_REDIRECT_URI');

    const allowed = (
      this.configService.get<string[]>('frontendOrigins') ?? []
    ).map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return origin.replace(/\/+$/, '');
      }
    });

    if (allowed.length > 0) {
      if (!allowed.includes(url.origin))
        throw new BadRequestException('INVALID_REDIRECT_URI');
      return url.toString();
    }

    const isLoopback =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]';
    if (process.env.NODE_ENV === 'production' || !isLoopback)
      throw new BadRequestException('INVALID_REDIRECT_URI');

    return url.toString();
  }

  async handleSocialCallback(
    dto: SocialLoginDto,
    device: ClientDeviceInfo | null = null,
  ): Promise<AuthResult> {
    // The state gate runs first and consumes the nonce whatever happens next,
    // so a rejected callback is never replayable.
    if (!(await this.socialState.consume(dto.state, dto.provider)))
      throw new UnauthorizedException('INVALID_OAUTH_STATE');

    if (!dto.accessToken)
      throw new UnauthorizedException(
        'accessToken is required for social callback',
      );
    const { data, error } = await this.supabaseService.getUser(dto.accessToken);
    if (error || !data.user)
      throw new UnauthorizedException('Invalid social access token');

    // The token must actually belong to the provider the client claims: a
    // Google token presented as `facebook` would otherwise be recorded as a
    // Facebook link for that account.
    this.assertSocialProvider(data.user, dto.provider);
    this.assertConfirmedSocialEmail(data.user);

    const user =
      dto.mode === 'admin'
        ? await this.resolveSocialAdminUser(dto.provider, data.user)
        : await this.mirrorSupabaseUser(
            {
              id: data.user.id,
              email: data.user.email,
              phone: data.user.phone,
            },
            dto.provider,
          );
    await this.assertAccountActive(user);
    return this.finishLogin(user, device);
  }

  /**
   * Attach a provider identity to the signed-in account. This never mints
   * tokens and never matches on email: the caller is authenticated, so the
   * provider identity is linked as-is. The emailed login path keeps its own
   * `email_confirmed_at` gate.
   */
  async linkSocialProvider(
    userId: string,
    dto: LinkSocialProviderDto,
  ): Promise<{
    provider: 'google' | 'facebook';
    providerAccountId: string;
    linked: true;
  }> {
    const { data, error } = await this.supabaseService.getUser(dto.accessToken);
    if (error || !data.user)
      throw new UnauthorizedException({
        code: 'INVALID_PROVIDER_TOKEN',
        message: 'Invalid social access token',
      });

    this.assertSocialProvider(data.user, dto.provider);
    const providerAccountId = data.user.id?.trim();
    if (!providerAccountId || providerAccountId.length > 120)
      throw new UnauthorizedException({
        code: 'INVALID_PROVIDER_TOKEN',
        message: 'Invalid social access token',
      });

    const linkedTo = await this.findUserByProviderAccount(
      dto.provider,
      providerAccountId,
    );
    if (linkedTo && linkedTo.id !== userId)
      throw new ConflictException({
        code: 'PROVIDER_ACCOUNT_ALREADY_LINKED',
        message: 'That account is already connected to another user.',
      });

    const [existing] = await this.db
      .select()
      .from(userAuthProviders)
      .where(
        and(
          eq(userAuthProviders.userId, userId),
          eq(userAuthProviders.provider, dto.provider),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.providerAccountId === providerAccountId)
        return { provider: dto.provider, providerAccountId, linked: true };
      if (existing.providerAccountId !== null)
        throw new ConflictException({
          code: 'PROVIDER_ALREADY_LINKED',
          message:
            'A different account for this provider is already connected.',
        });

      // A legacy row with no account id: fill it in rather than 409.
      await this.db
        .update(userAuthProviders)
        .set({ providerAccountId })
        .where(eq(userAuthProviders.id, existing.id));
      return { provider: dto.provider, providerAccountId, linked: true };
    }

    try {
      await this.db.insert(userAuthProviders).values({
        userId,
        provider: dto.provider,
        providerAccountId,
      });
    } catch (error) {
      // The unique (userId, provider) index catches a concurrent link.
      if (isUniqueViolation(error))
        throw new ConflictException({
          code: 'PROVIDER_ALREADY_LINKED',
          message: 'This provider is already connected to your account.',
        });
      throw error;
    }

    return { provider: dto.provider, providerAccountId, linked: true };
  }

  /**
   * Remove a linked provider. Refuses when it is the account's last way in:
   * a phone, a username + password, or another provider row must remain. The
   * user row is locked so two concurrent unlinks cannot each count the other
   * as the remaining method.
   */
  async unlinkSocialProvider(
    userId: string,
    provider: string,
  ): Promise<{ provider: string; unlinked: boolean }> {
    if (
      provider !== 'google' &&
      provider !== 'facebook' &&
      provider !== 'telegram'
    )
      throw new BadRequestException({
        code: 'UNSUPPORTED_PROVIDER',
        message: 'Unsupported provider',
      });

    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      if (!user)
        throw new UnauthorizedException({
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Account not found',
        });

      const rows = await tx
        .select({
          provider: userAuthProviders.provider,
          providerAccountId: userAuthProviders.providerAccountId,
        })
        .from(userAuthProviders)
        .where(eq(userAuthProviders.userId, userId));

      const isLinked = rows.some((row) => row.provider === provider);
      if (!isLinked) return { provider, unlinked: false };

      const hasFallback =
        user.primaryPhone !== null ||
        (user.username !== null && user.passwordHash !== null) ||
        rows.some(
          (row) =>
            row.provider !== provider &&
            row.providerAccountId !== null &&
            (row.provider === 'google' ||
              row.provider === 'facebook' ||
              row.provider === 'telegram'),
        );
      if (!hasFallback)
        throw new ConflictException({
          code: 'LAST_LOGIN_METHOD',
          message: 'This is your only way to sign in.',
        });

      await tx
        .delete(userAuthProviders)
        .where(
          and(
            eq(userAuthProviders.userId, userId),
            eq(userAuthProviders.provider, provider),
          ),
        );

      return { provider, unlinked: true };
    });
  }

  async loginWithTelegram(
    payload: TelegramAuthPayload,
    device: ClientDeviceInfo | null = null,
  ): Promise<AuthResult> {
    const botToken = this.configService.get<string>('telegram.botToken');
    if (!botToken)
      throw new UnauthorizedException('Telegram login not configured');

    // The payload is an interface, so the ValidationPipe never checks it — a
    // missing or non-hex hash would otherwise throw inside Buffer.from (500).
    if (
      typeof payload?.hash !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(payload.hash) ||
      typeof payload.auth_date !== 'number'
    ) {
      throw new UnauthorizedException('Invalid Telegram auth data');
    }

    const secretKey = createHash('sha256').update(botToken).digest();
    const checkString = Object.entries(payload)
      .filter(([k]) => k !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join('\n');

    const hmac = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');
    const receivedHash = Buffer.from(payload.hash, 'hex');
    const computedHash = Buffer.from(hmac, 'hex');

    if (
      receivedHash.length !== computedHash.length ||
      !timingSafeEqual(receivedHash, computedHash)
    ) {
      throw new UnauthorizedException('Invalid Telegram auth data');
    }

    const authAge = Math.floor(Date.now() / 1000) - payload.auth_date;
    if (authAge > 86400)
      throw new UnauthorizedException('Telegram auth data expired');

    const telegramId = String(payload.id);

    const [existingLink] = await this.db
      .select()
      .from(userAuthProviders)
      .where(
        and(
          eq(userAuthProviders.provider, 'telegram'),
          eq(userAuthProviders.providerAccountId, telegramId),
        ),
      )
      .limit(1);

    let user: UserRow;
    if (existingLink) {
      const [found] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, existingLink.userId))
        .limit(1);
      if (!found) throw new UnauthorizedException('User not found');
      user = found;
    } else {
      const base = buildUsernameBase(payload.first_name, payload.last_name);
      const username =
        base !== null ? await generateUniqueUsername(this.db, base) : null;
      const [inserted] = await this.db
        .insert(users)
        .values({
          firstName: payload.first_name ?? null,
          lastName: payload.last_name ?? null,
          username,
          profilePhotoUrl: payload.photo_url ?? null,
        })
        .returning();
      user = inserted;

      await this.db.insert(userAuthProviders).values({
        userId: user.id,
        provider: 'telegram',
        providerAccountId: telegramId,
      });
    }

    await this.assertAccountActive(user);
    return this.finishLogin(user, device);
  }

  async refresh(
    dto: RefreshDto,
    device: ClientDeviceInfo | null = null,
  ): Promise<AuthTokens> {
    let payload: {
      sub: string;
      role: 'user' | 'admin' | 'super_admin';
      sid?: string;
      gen?: number;
      iat?: number;
    };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.sid !== undefined && !SESSION_ID_PATTERN.test(payload.sid)) {
      throw new UnauthorizedException('Invalid session');
    }
    if (
      payload.gen !== undefined &&
      (!Number.isSafeInteger(payload.gen) || payload.gen < 0)
    ) {
      throw new UnauthorizedException('Invalid session');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || user.status !== 'active' || user.deletedAt)
      throw new UnauthorizedException('User not found');

    // A password reset sets a cutoff that also covers tokens with no `sid`.
    if (isIssuedBeforeCutoff(payload.iat, user.tokensValidAfter))
      throw new UnauthorizedException('Session revoked');

    // New tokens carry the row's revocation epoch and refresh generation. A
    // rotated id means the device was revoked, so the refresh token dies with
    // the access token; a stale generation means the token was replayed.
    if (payload.sid) {
      const rotation = await this.loginDevices.rotateRefreshToken(
        user.id,
        payload.sid,
        payload.gen ?? 0,
      );
      if (rotation.status === 'reuse') {
        throw new UnauthorizedException('Refresh token reused');
      }
      if (rotation.status === 'unknown')
        throw new UnauthorizedException('Session revoked');
      return this.issueTokens(user, payload.sid, rotation.epoch);
    }

    // A legacy (no-`sid`) refresh token can be bound on its first refresh.
    // A row that exists but was revoked must reject — never fall back to a
    // sid-less token for a device we know was signed out.
    if (device) {
      const row = await this.loginDevices.findSessionByDeviceId(
        user.id,
        device.id,
      );
      if (row) {
        if (row.revokedAt) throw new UnauthorizedException('Session revoked');
        const active = await this.loginDevices.touchActiveSession(
          user.id,
          row.sessionId,
        );
        if (!active) throw new UnauthorizedException('Session revoked');
        return this.issueTokens(user, row.sessionId, row.refreshEpoch ?? 0);
      }
    }

    return this.issueTokens(user);
  }

  /**
   * The account a sign-in should bring back: soft-deleted, inside the
   * retention window, and still holding a phone number.
   *
   * That last condition is the whole distinction between the two ways an
   * account becomes soft-deleted. `UsersService.deleteOwnAccount` keeps the
   * phone — recovery has to be possible — while `AdminService.deleteUser`
   * clears it. So "still has a phone" means the owner left on their own, and
   * an account an admin removed can never be revived by signing in.
   */
  private async findRecoverable(identifier: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(
        and(
          or(
            eq(users.username, identifier),
            eq(users.username, normalizeUsername(identifier)),
            eq(users.primaryPhone, identifier),
          ),
          isNotNull(users.deletedAt),
          isNotNull(users.primaryPhone),
          // The database's clock, not this process's — the same window the
          // purge sweeper evaluates.
          gt(
            users.deletedAt,
            sql`now() - make_interval(days => ${ACCOUNT_RETENTION_DAYS})`,
          ),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Clears the deletion. Idempotent — a concurrent sign-in may have won the
   * race.
   *
   * It does write `status: 'active'`, and that is safe ONLY because the WHERE
   * excludes `suspended`: the predicate, not the setter, is what keeps a
   * suspension intact. A row can be soft-deleted and suspended at once (a
   * self-delete keeps the phone, and staff can suspend such a row), and only
   * staff may lift that. Removing the predicate to "simplify" this would turn
   * a suspended account back into a live one.
   */
  private async revive(userId: string): Promise<UserRow> {
    const [row] = await this.db
      .update(users)
      // Clearing the marker must never lift a suspension (the callers refuse a
      // suspended row first; this is the second lock). Any other status may be
      // revived — an admin can set `active` without clearing `deletedAt`,
      // and requiring exactly `deleted` there stranded the account: the update
      // matched nothing, the login "succeeded", and every later request 401'd
      // on the marker this could no longer clear.
      .set({ status: 'active', deletedAt: null })
      .where(
        and(
          eq(users.id, userId),
          isNotNull(users.deletedAt),
          ne(users.status, 'suspended'),
        ),
      )
      .returning();
    if (row) return row;

    const [current] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!current) throw new UnauthorizedException('INVALID_CREDENTIALS');
    // The update above cannot clear a suspension, so a suspended row must not
    // fall through to token issuance through the race-loser path.
    await this.assertNotSuspended(current);
    // Still soft-deleted means the update matched nothing: handing out tokens
    // here would answer "success" and then 401 every request, forever.
    if (current.deletedAt)
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    return current;
  }

  /**
   * Every token-issuing path must pass through this. `loginWithPassword` and
   * `refresh` check inline; the alternate providers (OTP verify, social,
   * Telegram) do not, and a suspended account must not mint a session through
   * any of them.
   *
   * The refusal carries the stored reason and the support channels: a
   * suspended account cannot log in to read an in-app notice, so the login
   * error is the only surface where it can learn why and who to contact. It is
   * thrown after the credential check on every path, so it never reveals
   * whether an identifier exists.
   */
  private async assertAccountActive(user: UserRow): Promise<void> {
    if (user.status !== 'active' || user.deletedAt) {
      throw await this.suspendedRefusal(user);
    }
  }

  /**
   * A revival candidate is soft-deleted by definition, so it can never pass
   * `assertAccountActive`. The one state that must still block it is a
   * suspension: reviving would clear a decision nobody lifted.
   */
  private async assertNotSuspended(user: UserRow): Promise<void> {
    if (user.status === 'suspended') throw await this.suspendedRefusal(user);
  }

  private async suspendedRefusal(user: UserRow): Promise<ForbiddenException> {
    // Settings reads never throw (SettingsService falls back to defaults), so
    // a broken settings row cannot turn a refusal into a 500.
    const support = await this.settings.supportContacts();
    return new ForbiddenException({
      code: 'ACCOUNT_SUSPENDED',
      message: user.statusReason ?? 'This account is suspended.',
      // The exception filter only forwards `code` and `details`, so the
      // structured payload the client needs lives there.
      details: { reason: user.statusReason, support },
    });
  }

  /**
   * Moderation ban. The number may never register, receive an OTP, or be
   * added to another account — the ban outlives the account's hard purge.
   */
  private async assertPhoneNotBanned(phone: string): Promise<void> {
    if (await isPhoneBanned(this.db, phone)) {
      throw new ForbiddenException({
        code: 'PHONE_BANNED',
        message: 'This phone number has been banned.',
      });
    }
  }

  /**
   * The single success exit for every login path: records the device first,
   * then signs tokens carrying its revocation epoch (`sid`). `recordLogin`
   * never throws, so a device or notification failure cannot turn a valid
   * credential check into a 500; a row that could not be written yields a
   * token without `sid`, exactly like a legacy session.
   */
  private async finishLogin(
    user: UserRow,
    device: ClientDeviceInfo | null,
  ): Promise<AuthResult> {
    const recorded = await this.loginDevices.recordLogin(user.id, device);
    const tokens = this.issueTokens(
      user,
      recorded.sessionId,
      recorded.refreshEpoch,
    );
    return {
      ...tokens,
      user: this.toPublicUser(user),
      newDevice: recorded.isNewDevice,
    };
  }

  private issueTokens(
    user: UserRow,
    sessionId: string | null = null,
    refreshEpoch = 0,
  ): AuthTokens {
    const jwtPayload = {
      sub: user.id,
      role: user.role,
      ...(sessionId ? { sid: sessionId, gen: refreshEpoch } : {}),
    };
    const accessExpiresIn = (this.configService.get<string>(
      'jwt.accessExpiresIn',
    ) ?? '15m') as unknown as number;
    const refreshExpiresIn = (this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) ?? '30d') as unknown as number;
    const accessToken = this.jwtService.sign(jwtPayload, {
      expiresIn: accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(jwtPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn') ?? '15m',
    };
  }

  private assertSocialProvider(
    user: {
      identities?: { provider?: string }[];
      app_metadata?: { provider?: string };
    },
    provider: 'google' | 'facebook',
  ): void {
    const identities = user.identities ?? [];
    const matches =
      identities.length > 0
        ? identities.some((identity) => identity.provider === provider)
        : user.app_metadata?.provider === provider;
    if (!matches) throw new UnauthorizedException('SOCIAL_PROVIDER_MISMATCH');
  }

  private assertConfirmedSocialEmail(user: {
    email?: string;
    email_confirmed_at?: string;
  }): void {
    if (!user.email?.trim())
      throw new UnauthorizedException('SOCIAL_EMAIL_REQUIRED');
    if (!user.email_confirmed_at)
      throw new UnauthorizedException('SOCIAL_EMAIL_UNVERIFIED');
  }

  /**
   * Social identity resolution, in order of trust:
   *   1. an existing (provider, provider account id) link — stable even when
   *      the provider email changes;
   *   2. a non-deleted local account with the same email whose own email is
   *      verified (`emailVerifiedAt` is set);
   *   3. otherwise a new account created by the email upsert (the partial
   *      unique index keeps concurrent first logins safe).
   *
   * The provider's `email_confirmed_at` only proves the provider controls the
   * address, not that the local row does: anyone can write an email through
   * `PATCH /users/me` without verification. Auto-linking on an unverified
   * local row would therefore hand that account to whoever typed the victim's
   * address first. An unverified collision is refused with a stable code
   * instead, and the user links the provider explicitly from Settings through
   * `linkSocialProvider`.
   */
  private async resolveSocialUser(
    provider: 'google' | 'facebook',
    providerAccountId: string,
    email: string,
  ): Promise<UserRow> {
    const linked = await this.findUserByProviderAccount(
      provider,
      providerAccountId,
    );
    if (linked) return linked;

    const existing = await this.findUserByEmail(email);
    if (existing) {
      if (!existing.emailVerifiedAt) {
        throw new ConflictException({
          code: 'EMAIL_LINK_REQUIRED',
          message:
            'An account already uses this email. Sign in with your existing method and link this provider from Settings.',
        });
      }
      await this.linkProvider(existing.id, provider, providerAccountId);
      return existing;
    }

    const [created] = await this.db
      .insert(users)
      // The provider already proved it controls this address
      // (`email_confirmed_at`), so the brand-new row's email is verified from
      // the start. That is what lets the same person link a second provider
      // later without tripping the unverified-collision gate.
      .values({ email, emailVerifiedAt: new Date() })
      .onConflictDoUpdate({
        target: users.email,
        targetWhere: isNull(users.deletedAt),
        set: { updatedAt: new Date() },
      })
      .returning();

    // A concurrent first login can win the upsert with a row this social flow
    // did not create. If that row's email was never verified, it is exactly
    // the unverified collision above — refuse instead of linking it.
    if (!created.emailVerifiedAt) {
      throw new ConflictException({
        code: 'EMAIL_LINK_REQUIRED',
        message:
          'An account already uses this email. Sign in with your existing method and link this provider from Settings.',
      });
    }

    await this.linkProvider(created.id, provider, providerAccountId);
    return created;
  }

  /**
   * Admin social login only ever signs in an EXISTING staff account: no
   * insert and no revive. Every failure answers the same 401 so the endpoint
   * cannot be used to probe which emails are registered or which role they
   * hold.
   */
  private async resolveSocialAdminUser(
    provider: 'google' | 'facebook',
    supabaseUser: { id: string; email?: string },
  ): Promise<UserRow> {
    const email = supabaseUser.email?.trim().toLowerCase();
    if (!email) throw new UnauthorizedException('SOCIAL_LOGIN_NOT_ALLOWED');

    const linked = await this.findUserByProviderAccount(
      provider,
      supabaseUser.id,
    );
    const user = linked ?? (await this.findUserByEmail(email));

    if (
      !user ||
      user.deletedAt ||
      user.status !== 'active' ||
      (user.role !== 'admin' && user.role !== 'super_admin')
    ) {
      throw new UnauthorizedException('SOCIAL_LOGIN_NOT_ALLOWED');
    }

    await this.linkProvider(user.id, provider, supabaseUser.id);
    return user;
  }

  private async findUserByProviderAccount(
    provider: 'google' | 'facebook',
    providerAccountId: string,
  ): Promise<UserRow | null> {
    const [row] = await this.db
      .select({ user: users })
      .from(userAuthProviders)
      .innerJoin(users, eq(users.id, userAuthProviders.userId))
      .where(
        and(
          eq(userAuthProviders.provider, provider),
          eq(userAuthProviders.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);
    return row?.user ?? null;
  }

  private async findUserByEmail(email: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(
        and(
          sql`lower(${users.email}) = ${email.toLowerCase()}`,
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async linkProvider(
    userId: string,
    provider: 'google' | 'facebook',
    providerAccountId: string,
  ): Promise<void> {
    await this.db
      .insert(userAuthProviders)
      .values({ userId, provider, providerAccountId })
      .onConflictDoUpdate({
        target: [userAuthProviders.userId, userAuthProviders.provider],
        set: { providerAccountId },
      });
  }

  async mirrorSupabaseUser(
    supabaseUser: { id: string; phone?: string; email?: string },
    provider: 'phone' | 'google' | 'facebook',
    phone?: string,
    insertExtras?: Partial<typeof users.$inferInsert>,
  ): Promise<UserRow> {
    const resolvedPhone = phone ?? supabaseUser.phone ?? null;
    // Defence in depth: every caller that resolves a phone is checked at its
    // own entry point too, but this is the last gate before a row is created
    // or returned for a number moderation banned.
    if (resolvedPhone) await this.assertPhoneNotBanned(resolvedPhone);

    let user: UserRow;

    if (provider === 'phone') {
      const [row] = await this.db
        .insert(users)
        .values({ primaryPhone: resolvedPhone, ...insertExtras })
        .onConflictDoUpdate({
          target: users.primaryPhone,
          targetWhere: isNull(users.deletedAt),
          set: { updatedAt: new Date() },
        })
        .returning();
      user = row;

      await this.db
        .insert(userAuthProviders)
        .values({ userId: user.id, provider })
        .onConflictDoNothing({
          target: [userAuthProviders.userId, userAuthProviders.provider],
        });
    } else {
      const email = supabaseUser.email?.trim().toLowerCase();
      if (!email) throw new UnauthorizedException('SOCIAL_EMAIL_REQUIRED');
      user = await this.resolveSocialUser(provider, supabaseUser.id, email);
    }

    if (resolvedPhone) {
      await this.db
        .insert(userPhones)
        .values({ userId: user.id, phone: resolvedPhone, isPrimary: true })
        .onConflictDoNothing();
    }

    return user;
  }

  private toPublicUser(user: UserRow): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, tokensValidAfter: _tv, ...publicUser } = user;
    return publicUser;
  }

  async findById(
    id: string,
  ): Promise<PublicUser & { verifiedAccount: boolean }> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    return {
      ...this.toPublicUser(user),
      verifiedAccount: await hasActivePaidSubscription(this.db, id),
    };
  }
}
