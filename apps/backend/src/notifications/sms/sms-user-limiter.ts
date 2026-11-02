import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { SMS_RATE_LIMIT_REDIS } from './sms-rate-limiter';

const DAILY_TTL_SECONDS = 86_400;

/**
 * Takes one slot for (user, type) atomically, in this order:
 *  1. the cooldown key already holds THIS event's id -> a retry of the same
 *     event, which already owns the slot: allowed, nothing is counted twice;
 *  2. the cooldown key holds anything else -> `cooldown` (nothing changes);
 *  3. the daily counter would pass the cap -> `daily_cap` (nothing changes);
 *  4. otherwise count the day and `SET cooldown <eventId> EX` -> allowed.
 * Doing it in one script (rather than SET NX then INCR) means a message
 * refused by the daily cap never burns the cooldown, and two requests racing
 * for the same slot cannot both win.
 */
const ACQUIRE_SCRIPT = `
local holder = redis.call('GET', KEYS[1])
if holder == ARGV[1] then return 1 end
if holder then return 2 end
local n = redis.call('INCR', KEYS[2])
if n == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4])) end
if n > tonumber(ARGV[3]) then
  redis.call('DECR', KEYS[2])
  return 3
end
redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', tonumber(ARGV[2]))
return 1
`;

/** Gives the slot back, but only if this event is the one holding it. */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1])
  local n = redis.call('DECR', KEYS[2])
  if n < 0 then redis.call('SET', KEYS[2], 0, 'KEEPTTL') end
  return 1
end
return 0
`;

export type SmsUserLimitDecision =
  | 'allowed'
  | 'cooldown'
  | 'daily_cap'
  | 'unavailable';

export interface SmsUserSlot {
  userId: string;
  notificationType: string;
  /** The outbox event id: makes a retry of the same event idempotent. */
  eventId: string;
}

/**
 * Neutral form of a slot: `subject` is whoever is being protected from spam
 * (a user id, or an opaque phone key for OTP sends where no user exists yet)
 * and `scope` is the thing that has its own cooldown (a notification type or
 * an OTP purpose). `SmsUserSlot` maps onto it, key-for-key.
 */
export interface SmsSubjectSlot {
  subject: string;
  scope: string;
  eventId: string;
}

/**
 * Per-user SMS spam limits: one SMS per user per notification type per
 * `SMS_USER_COOLDOWN_SECONDS` (default 300) and `SMS_USER_DAILY_CAP`
 * (default 10) per user per day. Shares the SMS Redis connection with
 * `SmsRateLimiter` and, like it, FAILS CLOSED (`unavailable` -> the handler
 * retries) — never "limits not tracked, send anyway".
 */
@Injectable()
export class SmsUserLimiter {
  private readonly logger = new Logger(SmsUserLimiter.name);

  constructor(
    @Inject(SMS_RATE_LIMIT_REDIS) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async acquire(slot: SmsUserSlot): Promise<SmsUserLimitDecision> {
    return this.acquireSubject(this.toSubject(slot));
  }

  async release(slot: SmsUserSlot): Promise<void> {
    return this.releaseSubject(this.toSubject(slot));
  }

  async acquireSubject(slot: SmsSubjectSlot): Promise<SmsUserLimitDecision> {
    const cooldown =
      this.configService.get<number>('sms.userCooldownSeconds') ?? 300;
    const cap = this.configService.get<number>('sms.userDailyCap') ?? 10;
    try {
      const code = await this.redis.eval(
        ACQUIRE_SCRIPT,
        2,
        this.cooldownKey(slot),
        this.dailyKey(slot),
        slot.eventId,
        String(cooldown),
        String(cap),
        String(DAILY_TTL_SECONDS),
      );
      if (code === 1) return 'allowed';
      return code === 2 ? 'cooldown' : 'daily_cap';
    } catch (err) {
      this.logger.warn(`SMS user limiter unavailable: ${this.message(err)}`);
      return 'unavailable';
    }
  }

  /**
   * Best-effort: called when an acquired slot ends up not being used (the
   * global limiter or PlasGate asked for a retry). If this fails the slot is
   * still safe — the retry of the same event reuses it (see ACQUIRE_SCRIPT).
   */
  async releaseSubject(slot: SmsSubjectSlot): Promise<void> {
    try {
      await this.redis.eval(
        RELEASE_SCRIPT,
        2,
        this.cooldownKey(slot),
        this.dailyKey(slot),
        slot.eventId,
      );
    } catch (err) {
      this.logger.warn(`SMS user limiter release failed: ${this.message(err)}`);
    }
  }

  /**
   * Seconds left on the slot's cooldown, or `null` when it is not cooling
   * down or Redis cannot say (callers fall back to the configured cooldown).
   */
  async cooldownRemainingSeconds(slot: SmsSubjectSlot): Promise<number | null> {
    try {
      const ttl = await this.redis.ttl(this.cooldownKey(slot));
      return ttl > 0 ? ttl : null;
    } catch {
      return null;
    }
  }

  private toSubject(s: SmsUserSlot): SmsSubjectSlot {
    return { subject: s.userId, scope: s.notificationType, eventId: s.eventId };
  }

  private cooldownKey(s: SmsSubjectSlot): string {
    return `sms:user:cooldown:${s.subject}:${s.scope}`;
  }

  private dailyKey(s: SmsSubjectSlot): string {
    return `sms:user:daily:${s.subject}`;
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
