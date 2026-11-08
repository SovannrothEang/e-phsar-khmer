import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import {
  THROTTLER_REDIS,
  throttleKeyPrefix,
} from '../common/throttler/throttler-storage';

/**
 * Failure count -> lock duration. Ordered high to low; the first tier the
 * count reaches wins, so the backoff only ever grows inside one window.
 */
export const ACCOUNT_LOCKOUT_TIERS = [
  { failures: 15, seconds: 900 },
  { failures: 10, seconds: 300 },
  { failures: 5, seconds: 60 },
] as const;

/**
 * How long a failure keeps counting towards the next tier. Long enough that a
 * slow password-spraying campaign still escalates, short enough that a user
 * who mistyped a few times last week starts clean.
 */
export const LOCKOUT_FAILURE_WINDOW_SECONDS = 86_400;

/**
 * One key per account: usernames and emails lowercased, phone numbers reduced
 * to digits, so "SokDara", "sokdara" and "+855 12 345 678" / "85512345678"
 * share a counter with their own variants.
 */
export function normalizeLoginIdentifier(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return /^[+\d][\d\s-]*$/.test(trimmed) ? trimmed.replace(/\D/g, '') : trimmed;
}

export function lockDurationSeconds(failures: number): number {
  for (const tier of ACCOUNT_LOCKOUT_TIERS) {
    if (failures >= tier.failures) return tier.seconds;
  }
  return 0;
}

/**
 * Per-account failed-login lockout, independent of the IP buckets. Needed
 * because every web auth call arrives from Next's server, so the IP-keyed
 * throttler shares one bucket across all web users and cannot stop a
 * credential-stuffing run against a single account.
 *
 * The identifier is hashed before it becomes a key (and is never logged):
 * proportional guessing is bounded even for identifiers that do not exist,
 * because unknown identifiers get exactly the same counter and the same 429
 * shape — the lockout is not an existence oracle.
 *
 * FAILS OPEN, like the throttler storage: a Redis error logs a warning and
 * lets the attempt through. Availability of sign-in wins over this extra
 * limit; the per-route IP buckets still apply.
 */
@Injectable()
export class LoginLockoutService {
  private readonly logger = new Logger(LoginLockoutService.name);
  private readonly prefix: string;

  constructor(
    @Inject(THROTTLER_REDIS) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    this.prefix = throttleKeyPrefix(configService);
  }

  /** Throws the 429 before any credential work if the account is locked. */
  async assertNotLocked(rawIdentifier: string): Promise<void> {
    let ttlMs: number;
    try {
      ttlMs = await this.redis.pttl(this.lockKey(rawIdentifier));
    } catch (err) {
      this.warn('check', err);
      return;
    }
    if (ttlMs <= 0) return;
    throw new HttpException(
      {
        code: 'ACCOUNT_LOCKED',
        message: 'Too many failed attempts. Please try again later.',
        retryAfterSeconds: Math.ceil(ttlMs / 1000),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Counts one failed credential check and arms the tier's lock. INCR is
   * atomic, and the lock SET is idempotent, so two concurrent wrong guesses
   * cannot lose a failure or clear each other's lock.
   */
  async recordFailure(rawIdentifier: string): Promise<void> {
    try {
      const key = this.failureKey(rawIdentifier);
      const failures = await this.redis.incr(key);
      if (failures === 1) {
        await this.redis.expire(key, LOCKOUT_FAILURE_WINDOW_SECONDS);
      }
      const seconds = lockDurationSeconds(failures);
      if (seconds > 0) {
        await this.redis.set(
          this.lockKey(rawIdentifier),
          String(failures),
          'EX',
          seconds,
        );
      }
    } catch (err) {
      this.warn('record', err);
    }
  }

  /** Clears both the counter and any lock after a proven credential. */
  async reset(rawIdentifier: string): Promise<void> {
    try {
      await this.redis.del(
        this.failureKey(rawIdentifier),
        this.lockKey(rawIdentifier),
      );
    } catch (err) {
      this.warn('reset', err);
    }
  }

  /** Hashed so the raw identifier never lands in Redis or in a log line. */
  private subject(rawIdentifier: string): string {
    return createHash('sha256')
      .update(normalizeLoginIdentifier(rawIdentifier))
      .digest('hex');
  }

  private failureKey(rawIdentifier: string): string {
    return `${this.prefix}:lockout:fail:${this.subject(rawIdentifier)}`;
  }

  private lockKey(rawIdentifier: string): string {
    return `${this.prefix}:lockout:lock:${this.subject(rawIdentifier)}`;
  }

  private warn(action: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Login lockout ${action} unavailable: ${message}`);
  }
}
