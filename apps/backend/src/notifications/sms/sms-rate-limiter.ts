import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

export const SMS_RATE_LIMIT_REDIS = 'SMS_RATE_LIMIT_REDIS';

const KEY = 'sms:rate:window';
const WINDOW_MS = 60_000;

/**
 * Removes entries older than the window, and — atomically with that read —
 * admits one more if the remaining count is under budget. Atomic because
 * every dispatcher instance runs this same script server-side: two
 * instances racing to acquire the last slot can't both win, which a
 * ZREMRANGEBYSCORE + ZCARD + ZADD done as separate round trips could.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return 1
else
  return 0
end
`;

export type SmsRateLimitDecision = 'allowed' | 'over_budget' | 'unavailable';

/**
 * Shared PlasGate budget (`SMS_RATE_LIMIT_PER_MINUTE`, default 150 — 50
 * requests of headroom under PlasGate's own 200/minute ceiling) enforced
 * across every backend instance via Redis, the same connection family
 * `ChatPubSubService` uses (`queueRedisOptions`).
 *
 * Fails CLOSED: a Redis error returns `unavailable`, which
 * `SmsOutboxHandler` treats as `retry` — never as "budget not tracked, send
 * anyway". That is the one place this differs from "fail open" rate
 * limiters, and it is deliberate: silently exceeding PlasGate's ceiling
 * risks the account being throttled or suspended entirely.
 */
@Injectable()
export class SmsRateLimiter implements OnModuleDestroy {
  private readonly logger = new Logger(SmsRateLimiter.name);

  constructor(
    @Inject(SMS_RATE_LIMIT_REDIS) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  /** Closes the dedicated Redis connection on shutdown (as `ChatPubSubService` does). */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  async tryAcquire(): Promise<SmsRateLimitDecision> {
    const limit =
      this.configService.get<number>('sms.rateLimitPerMinute') ?? 150;
    const now = Date.now();
    const member = `${now}-${Math.random().toString(36).slice(2)}`;

    try {
      const admitted = await this.redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        KEY,
        String(now),
        String(WINDOW_MS),
        String(limit),
        member,
      );
      return admitted === 1 ? 'allowed' : 'over_budget';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`SMS rate limiter unavailable: ${message}`);
      return 'unavailable';
    }
  }
}
