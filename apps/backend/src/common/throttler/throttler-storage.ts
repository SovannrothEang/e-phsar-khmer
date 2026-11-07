import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

/** Injection token for the dedicated Redis client this storage owns. */
export const THROTTLER_REDIS = 'THROTTLER_REDIS';

/**
 * Shape `ThrottlerStorage.increment()` must return. Declared locally because
 * `@nestjs/throttler` v6 keeps `ThrottlerStorageRecord` internal (it is not
 * re-exported from the package root).
 */
export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Keys live beside the BullMQ namespace (`QUEUE_PREFIX`) so two environments
 * sharing one Redis never share counters or account lockouts.
 */
export function throttleKeyPrefix(configService: ConfigService): string {
  return `throttle:${configService.get<string>('queue.prefix') ?? 'phsar'}`;
}

/**
 * One atomic hit against a key. KEYS: 1 hit counter, 2 block marker.
 * ARGV: 1 ttl (ms), 2 limit, 3 blockDuration (ms).
 *
 * Mirrors `ThrottlerStorageService` (the in-memory default) semantics:
 *  - a window starts on the first hit and is never extended by later hits;
 *  - hits stop counting while the key is blocked;
 *  - passing the limit resets the counter and sets a block marker for
 *    `blockDuration`, so the next window starts clean once the block lifts.
 *
 * Atomic because the same script runs server-side for every instance: two
 * instances racing for the last slot under a shared counter cannot both win,
 * which INCR-then-PEXPIRE as separate round trips could.
 */
const INCREMENT_SCRIPT = `
local totalKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])

local blockPttl = redis.call('PTTL', blockKey)
if blockPttl == -1 then blockPttl = blockMs end
if blockPttl > 0 then
  local total = tonumber(redis.call('GET', totalKey) or '0')
  if total <= limit then total = limit + 1 end
  return { total, blockPttl, 1, blockPttl }
end

local total = redis.call('INCR', totalKey)
if total == 1 then
  redis.call('PEXPIRE', totalKey, ttl)
end
local totalPttl = redis.call('PTTL', totalKey)
if totalPttl < 0 then totalPttl = ttl end

if total > limit then
  redis.call('DEL', totalKey)
  redis.call('SET', blockKey, '1', 'PX', blockMs)
  return { total, totalPttl, 1, blockMs }
end

return { total, totalPttl, 0, 0 }
`;

/**
 * Redis-backed `ThrottlerStorage` for `@nestjs/throttler` v6, so the global
 * and per-route buckets are shared by every backend instance instead of
 * multiplying per process.
 *
 * Unit contract: `ttl` and `blockDuration` arrive in MILLISECONDS (the guard
 * passes them through unchanged) while `ThrottlerStorageRecord` reports
 * `timeToExpire` / `timeToBlockExpire` in SECONDS, which is what the guard
 * writes into `X-RateLimit-Reset` and `Retry-After`.
 *
 * FAILS OPEN: a Redis error answers "one hit, not blocked" and logs a
 * warning rather than throwing. Auth availability is more valuable than
 * limiting — a Redis outage must not lock every user out of signing in. The
 * trade-off is that a Redis outage temporarily disables rate limiting (the
 * per-account lockout in `LoginLockoutService` makes the same choice).
 */
@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly prefix: string;

  constructor(
    @Inject(THROTTLER_REDIS) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    this.prefix = throttleKeyPrefix(configService);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      // `eval` is ioredis's Redis#EVAL RPC, not JavaScript's eval(): the
      // script string is executed by Redis, never interpreted here.
      const result = (await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        this.totalKey(throttlerName, key),
        this.blockKey(throttlerName, key),
        String(ttl),
        String(limit),
        String(blockDuration),
      )) as [number, number, number, number];

      const [totalHits, ttlMs, blocked, blockMs] = result;
      return {
        totalHits,
        timeToExpire: Math.ceil(ttlMs / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockMs / 1000),
      };
    } catch (err) {
      this.logger.warn(
        `Throttler storage unavailable, allowing the request: ${this.message(err)}`,
      );
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  /** Closes the dedicated connection (one per instance) on shutdown. */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  private totalKey(throttlerName: string, key: string): string {
    return `${this.prefix}:${throttlerName}:total:${key}`;
  }

  private blockKey(throttlerName: string, key: string): string {
    return `${this.prefix}:${throttlerName}:block:${key}`;
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
