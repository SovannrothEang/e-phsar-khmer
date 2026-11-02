import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { OtpRepository } from './otp.repository';
import {
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  type IssuedOtp,
  type OtpPurpose,
  type OtpVerifyResult,
} from './otp.types';

const DERIVED_SECRET_LABEL = 'psa-npic:otp-hmac:v1';

/**
 * Issues and checks phone one-time codes. Codes are 6 digits, stored only as
 * HMAC-SHA256(secret, phone|purpose|code), valid 5 minutes, at most 5
 * guesses, single use. Delivery is `OtpSmsSender`'s job: `issue()` hands the
 * plain code back to the caller and keeps no copy.
 *
 * Dev bypass: when `DEV_OTP_TOKEN` is set, `verify` accepts exactly that
 * token for any phone and `issue` stores nothing. It is ignored (with an
 * error log at startup) when `NODE_ENV === 'production'`.
 */
@Injectable()
export class OtpService implements OnModuleInit {
  private readonly logger = new Logger(OtpService.name);
  private secret: Buffer | null = null;
  private devToken: string | null = null;
  private devTokenResolved = false;

  constructor(
    private readonly repo: OtpRepository,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.resolveDevToken();
  }

  /** `supabase` or `plasgate`; the wiring task reads this. */
  get provider(): 'supabase' | 'plasgate' {
    return (
      this.config.get<'supabase' | 'plasgate'>('otp.provider') ?? 'supabase'
    );
  }

  /** True when the (non-production) DEV_OTP_TOKEN bypass is in effect. */
  get devBypassActive(): boolean {
    return this.resolveDevToken() !== null;
  }

  async issue(
    phone: string,
    purpose: OtpPurpose,
    ip?: string | null,
  ): Promise<IssuedOtp> {
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const devToken = this.resolveDevToken();
    if (devToken) return { id: null, code: devToken, expiresAt };

    const code = this.generateCode();
    const row = await this.repo.replaceOpen({
      phone,
      purpose,
      codeHash: this.hash(phone, purpose, code),
      expiresAt,
      requestIp: ip ?? null,
    });
    return { id: row.id, code, expiresAt };
  }

  /** Withdraws a just-issued code (the SMS could not be delivered). */
  async invalidate(id: string | null): Promise<void> {
    if (id) await this.repo.invalidate(id);
  }

  async verify(
    phone: string,
    purpose: OtpPurpose | OtpPurpose[],
    code: string,
  ): Promise<OtpVerifyResult> {
    const purposes = Array.isArray(purpose) ? purpose : [purpose];

    const devToken = this.resolveDevToken();
    if (devToken && this.safeEqual(code, devToken)) {
      return { status: 'ok', purpose: purposes[0] };
    }

    const row = await this.repo.findLatestOpen(phone, purposes);
    if (!row) return { status: 'invalid' };
    if (row.expiresAt.getTime() <= Date.now()) return { status: 'expired' };
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      return { status: 'too_many_attempts' };
    }

    // Spend the attempt BEFORE comparing, so parallel guesses cannot all be
    // evaluated against attempts=0: at most OTP_MAX_ATTEMPTS ever get past.
    const reserved = await this.repo.reserveAttempt(row.id, OTP_MAX_ATTEMPTS);
    if (!reserved) return { status: 'too_many_attempts' };

    const expected = this.hash(phone, row.purpose, code);
    if (!this.safeEqual(expected, row.codeHash)) return { status: 'invalid' };

    // Two concurrent correct submissions: only one UPDATE matches.
    return (await this.repo.consume(row.id))
      ? { status: 'ok', purpose: row.purpose }
      : { status: 'invalid' };
  }

  private generateCode(): string {
    return randomInt(0, 10 ** OTP_CODE_LENGTH)
      .toString()
      .padStart(OTP_CODE_LENGTH, '0');
  }

  private hash(phone: string, purpose: OtpPurpose, code: string): string {
    return createHmac('sha256', this.getSecret())
      .update(`${phone}|${purpose}|${code}`)
      .digest('hex');
  }

  /** Constant-time compare; unequal lengths are rejected without comparing. */
  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }

  private getSecret(): Buffer {
    if (this.secret) return this.secret;
    const configured = this.config.get<string>('otp.hmacSecret');
    if (configured) {
      this.secret = Buffer.from(configured);
    } else {
      this.logger.warn(
        'OTP_HMAC_SECRET is not set; deriving the OTP hash key from JWT_SECRET. Set OTP_HMAC_SECRET to a separate random value.',
      );
      const jwtSecret = this.config.get<string>('jwt.secret') ?? '';
      this.secret = createHmac('sha256', jwtSecret)
        .update(DERIVED_SECRET_LABEL)
        .digest();
    }
    return this.secret;
  }

  private resolveDevToken(): string | null {
    if (this.devTokenResolved) return this.devToken;
    this.devTokenResolved = true;
    const token = this.config.get<string>('devOtpToken');
    if (!token) return null;
    if (this.config.get<string>('nodeEnv') === 'production') {
      this.logger.error(
        'DEV_OTP_TOKEN is set in production; the OTP bypass is IGNORED. Remove it from the environment.',
      );
      return null;
    }
    this.devToken = token;
    return token;
  }
}
