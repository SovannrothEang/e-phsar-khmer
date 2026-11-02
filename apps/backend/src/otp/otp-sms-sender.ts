import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { DRIZZLE, type DbClient } from '../db/drizzle.provider';
import { smsDeliveries } from '../db/schema';
import { maskPhone } from '../notifications/sms/mask-phone.util';
import {
  PlasGateClient,
  type PlasGateSendResult,
} from '../notifications/sms/plasgate-client';
import { SmsRateLimiter } from '../notifications/sms/sms-rate-limiter';
import {
  SmsUserLimiter,
  type SmsSubjectSlot,
} from '../notifications/sms/sms-user-limiter';
import { OtpService } from './otp.service';
import { OTP_TTL_MINUTES, type IssuedOtp, type OtpPurpose } from './otp.types';

export type OtpSendResult =
  | { status: 'sent'; retryAfterSeconds: number }
  | { status: 'cooldown'; retryAfterSeconds: number }
  | { status: 'daily_cap' }
  | { status: 'provider_rejected' }
  | { status: 'unavailable' };

const RETRY_DELAY_MS = 250;

/**
 * Sends a one-time code through PlasGate directly: never through the
 * notification outbox, because an outbox payload would hold the code in
 * plaintext until the event is terminal, and because the registering phone
 * has no user row to key the outbox event on.
 *
 * Limits are per PHONE (hashed into an opaque Redis subject), reusing
 * `SmsUserLimiter`: one SMS per phone+purpose per `SMS_USER_COOLDOWN_SECONDS`
 * (300) and `SMS_USER_DAILY_CAP` (10) per phone per day, then the global
 * `SmsRateLimiter`. Both fail closed. Neither the code nor the full phone is
 * ever logged or written to `sms_deliveries` (masked phone only).
 */
@Injectable()
export class OtpSmsSender {
  private readonly logger = new Logger(OtpSmsSender.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly otp: OtpService,
    private readonly plasGate: PlasGateClient,
    private readonly rateLimiter: SmsRateLimiter,
    private readonly userLimiter: SmsUserLimiter,
    private readonly config: ConfigService,
  ) {}

  /**
   * Preferred entry point. Takes the phone's slot FIRST, so a request that is
   * over the limit never issues a code (which would kill the one the user
   * already received), then issues and sends.
   */
  async issueAndSend(
    phone: string,
    purpose: OtpPurpose,
    ip?: string | null,
  ): Promise<OtpSendResult> {
    // Dev bypass: nothing is sent or stored; the fixed token is accepted.
    if (this.otp.devBypassActive) {
      await this.otp.issue(phone, purpose, ip);
      return { status: 'sent', retryAfterSeconds: this.cooldownSeconds() };
    }

    const slot = this.slotFor(phone, purpose, randomUUID());
    const blocked = await this.acquire(slot, phone, purpose);
    if (blocked) return blocked;

    const issued = await this.issueReleasingSlot(slot, phone, purpose, ip);
    return this.deliver(slot, phone, purpose, issued.code, issued.id);
  }

  /**
   * Account-recovery variant. Does everything `issueAndSend` does up to the
   * point of the PlasGate call, but does NOT wait for it: the caller gets
   * `sent` (or a cooldown/cap) as soon as the code is stored, so the response
   * time does not depend on PlasGate and a provider failure is not visible to
   * the requester. `reserveOnly` takes the same limiter slot for a number that
   * has no account, so both cases answer cooldown/cap identically.
   *
   * `delivery` settles when the background send has finished (it never
   * rejects); production callers ignore it, tests await it. A failed delivery
   * releases the slot and kills the code, exactly like `issueAndSend`.
   */
  async issueAndSendDetached(
    phone: string,
    purpose: OtpPurpose,
    ip?: string | null,
  ): Promise<{ result: OtpSendResult; delivery: Promise<void> }> {
    if (this.otp.devBypassActive) {
      await this.otp.issue(phone, purpose, ip);
      return {
        result: { status: 'sent', retryAfterSeconds: this.cooldownSeconds() },
        delivery: Promise.resolve(),
      };
    }

    const slot = this.slotFor(phone, purpose, randomUUID());
    const blocked = await this.acquire(slot, phone, purpose);
    if (blocked) return { result: blocked, delivery: Promise.resolve() };

    const issued = await this.issueReleasingSlot(slot, phone, purpose, ip);
    const delivery = this.deliver(slot, phone, purpose, issued.code, issued.id)
      .then(() => undefined)
      .catch(() => {
        this.logger.warn('Detached OTP delivery failed');
      });
    return {
      result: { status: 'sent', retryAfterSeconds: this.cooldownSeconds() },
      delivery,
    };
  }

  /**
   * Takes the phone's limiter slot and sends nothing: the stand-in for
   * `issueAndSendDetached` when the number has no eligible account, so that
   * a second request inside the cooldown (or past the daily cap) is refused
   * the same way whether or not the number is registered.
   */
  async reserveOnly(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<OtpSendResult> {
    if (this.otp.devBypassActive) {
      return { status: 'sent', retryAfterSeconds: this.cooldownSeconds() };
    }
    const slot = this.slotFor(phone, purpose, randomUUID());
    const blocked = await this.acquire(slot, phone, purpose);
    return (
      blocked ?? { status: 'sent', retryAfterSeconds: this.cooldownSeconds() }
    );
  }

  /**
   * `issue` runs AFTER the slot is taken (so an over-limit request can never
   * supersede a code the user already received), which means a DB failure
   * inside it would otherwise leave the phone locked out for the cooldown with
   * no code issued. Release the slot and rethrow.
   */
  private async issueReleasingSlot(
    slot: SmsSubjectSlot,
    phone: string,
    purpose: OtpPurpose,
    ip?: string | null,
  ): Promise<IssuedOtp> {
    try {
      return await this.otp.issue(phone, purpose, ip);
    } catch (err) {
      // Best-effort: releasing must not mask the original failure, but a
      // failed release means the lockout persists — log it so it is traceable.
      await this.userLimiter
        .releaseSubject(slot)
        .catch((releaseErr: unknown) =>
          this.logger.warn(
            `Could not release the OTP limiter slot: ${releaseErr instanceof Error ? releaseErr.message : String(releaseErr)}`,
          ),
        );
      throw err;
    }
  }

  buildMessage(purpose: OtpPurpose, code: string): string {
    return purpose === 'password_reset'
      ? `Your PSA password reset code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. If you did not ask for it, ignore this message.`
      : `Your PSA verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`;
  }

  private async acquire(
    slot: SmsSubjectSlot,
    phone: string,
    purpose: OtpPurpose,
  ): Promise<OtpSendResult | null> {
    const decision = await this.userLimiter.acquireSubject(slot);
    if (decision === 'allowed') return null;

    if (decision === 'cooldown') {
      const remaining = await this.userLimiter.cooldownRemainingSeconds(slot);
      await this.record(phone, purpose, 'skipped', {
        skipReason: 'rate_limited',
      });
      return {
        status: 'cooldown',
        retryAfterSeconds: remaining ?? this.cooldownSeconds(),
      };
    }
    if (decision === 'daily_cap') {
      await this.record(phone, purpose, 'skipped', { skipReason: 'daily_cap' });
      return { status: 'daily_cap' };
    }
    await this.record(phone, purpose, 'skipped', {
      skipReason: 'limiter_unavailable',
    });
    return { status: 'unavailable' };
  }

  private async deliver(
    slot: SmsSubjectSlot,
    phone: string,
    purpose: OtpPurpose,
    code: string,
    otpId: string | null,
  ): Promise<OtpSendResult> {
    const abandon = async (): Promise<void> => {
      await this.userLimiter.releaseSubject(slot);
      await this.otp.invalidate(otpId);
    };

    if (!this.plasGate.isConfigured()) {
      await this.record(phone, purpose, 'skipped', {
        skipReason: 'not_configured',
      });
      await abandon();
      return { status: 'unavailable' };
    }

    const to = this.plasGate.toInternational(phone);
    if (!to) {
      await this.record(phone, purpose, 'skipped', {
        skipReason: 'invalid_phone',
      });
      await abandon();
      return { status: 'provider_rejected' };
    }

    if ((await this.rateLimiter.tryAcquire()) !== 'allowed') {
      await this.record(phone, purpose, 'skipped', {
        skipReason: 'global_rate_limited',
      });
      await abandon();
      return { status: 'unavailable' };
    }

    const content = this.buildMessage(purpose, code);
    let result = await this.plasGate.send({ to, content });
    if (result.outcome === 'retry') {
      // One quick in-request retry; a second transient failure is final.
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      result = await this.plasGate.send({ to, content });
    }

    if (result.outcome === 'sent') {
      await this.record(phone, purpose, 'sent', { result, code });
      return { status: 'sent', retryAfterSeconds: this.cooldownSeconds() };
    }

    await this.record(phone, purpose, 'failed', { result, code });
    await abandon();
    return {
      status: result.outcome === 'failed' ? 'provider_rejected' : 'unavailable',
    };
  }

  /** Audit row. Never carries the code, message text or full phone. */
  private async record(
    phone: string,
    purpose: OtpPurpose,
    status: 'sent' | 'failed' | 'skipped',
    extra: {
      skipReason?: string;
      result?: PlasGateSendResult;
      code?: string;
    },
  ): Promise<void> {
    try {
      await this.db.insert(smsDeliveries).values({
        userId: null,
        notificationType: `otp.${purpose}`,
        purpose,
        maskedPhone: maskPhone(phone),
        status,
        skipReason: extra.skipReason ?? null,
        providerStatus: extra.result?.providerStatus ?? null,
        providerReply: this.scrub(extra.result?.providerReply, extra.code),
        attempts: status === 'skipped' ? 0 : 1,
        sentAt: status === 'sent' ? new Date() : null,
      });
    } catch {
      // The audit row is best-effort; never log the phone or code here.
      this.logger.warn(`Could not record OTP SMS delivery (${status})`);
    }
  }

  /** Defensive: a provider that echoed the message must not leak the code. */
  private scrub(reply: string | undefined, code?: string): string | null {
    if (!reply) return null;
    return code ? reply.split(code).join('[redacted]') : reply;
  }

  private slotFor(
    phone: string,
    purpose: OtpPurpose,
    eventId: string,
  ): SmsSubjectSlot {
    const subject = `otp-phone:${createHash('sha256').update(phone).digest('hex').slice(0, 32)}`;
    return { subject, scope: `otp.${purpose}`, eventId };
  }

  private cooldownSeconds(): number {
    return this.config.get<number>('sms.userCooldownSeconds') ?? 300;
  }
}
