import { RedisThrottlerStorage } from './throttler-storage';

/**
 * In-memory mirror of `INCREMENT_SCRIPT` (the only script the storage runs).
 * JS is single-threaded, so each `eval` is atomic here exactly as a script is
 * in Redis; this checks the storage contract and the decision logic, not the
 * Lua syntax. `advance()` moves the clock so expiry can be exercised without
 * timers.
 */
class FakeRedis {
  private readonly entries = new Map<
    string,
    { value: number; expiresAt: number | null }
  >();
  private clock = 1_700_000_000_000;
  fail = false;
  quit = jest.fn().mockResolvedValue('OK');
  disconnect = jest.fn();

  advance(ms: number): void {
    this.clock += ms;
  }

  // `eval` is ioredis's Redis#EVAL RPC, not JavaScript's eval().
  eval(
    _script: string,
    _numKeys: number,
    totalKey: string,
    blockKey: string,
    ttlArg: string,
    limitArg: string,
    blockArg: string,
  ): Promise<number[]> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    const ttl = Number(ttlArg);
    const limit = Number(limitArg);
    const blockMs = Number(blockArg);

    const blockPttl = this.pttl(blockKey);
    if (blockPttl > 0) {
      const total = this.value(totalKey) ?? 0;
      return Promise.resolve([
        total <= limit ? limit + 1 : total,
        blockPttl,
        1,
        blockPttl,
      ]);
    }

    const existing = this.live(totalKey);
    const total = (existing?.value ?? 0) + 1;
    const expiresAt = existing ? existing.expiresAt : this.clock + ttl;
    this.entries.set(totalKey, { value: total, expiresAt });
    let totalPttl = this.pttl(totalKey);
    if (totalPttl < 0) totalPttl = ttl;

    if (total > limit) {
      this.entries.delete(totalKey);
      this.entries.set(blockKey, {
        value: 1,
        expiresAt: this.clock + blockMs,
      });
      return Promise.resolve([total, totalPttl, 1, blockMs]);
    }
    return Promise.resolve([total, totalPttl, 0, 0]);
  }

  private live(
    key: string,
  ): { value: number; expiresAt: number | null } | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.clock) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  private value(key: string): number | null {
    return this.live(key)?.value ?? null;
  }

  private pttl(key: string): number {
    const entry = this.live(key);
    if (!entry) return -2;
    return entry.expiresAt === null ? -1 : entry.expiresAt - this.clock;
  }
}

const config = { get: () => 'test' } as never;

describe('RedisThrottlerStorage', () => {
  it('counts in seconds and blocks once the limit is passed', async () => {
    const redis = new FakeRedis();
    const storage = new RedisThrottlerStorage(redis as never, config);

    const first = await storage.increment('key', 60_000, 2, 30_000, 'default');
    expect(first).toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });

    const second = await storage.increment('key', 60_000, 2, 30_000, 'default');
    expect(second).toEqual({
      totalHits: 2,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });

    const third = await storage.increment('key', 60_000, 2, 30_000, 'default');
    expect(third.isBlocked).toBe(true);
    expect(third.timeToBlockExpire).toBe(30);
  });

  it('shares one counter and one block window between two instances', async () => {
    const redis = new FakeRedis();
    const instanceA = new RedisThrottlerStorage(redis as never, config);
    const instanceB = new RedisThrottlerStorage(redis as never, config);

    // A "3 per minute" route, blocked for two minutes when exceeded.
    const args = ['key', 60_000, 3, 120_000, 'default'] as const;
    expect((await instanceA.increment(...args)).totalHits).toBe(1);
    expect((await instanceB.increment(...args)).totalHits).toBe(2);
    expect((await instanceA.increment(...args)).totalHits).toBe(3);

    // The fourth hit blocks, and the block is visible to BOTH instances —
    // the whole point of Redis-backed counters.
    const blockedOnA = await instanceA.increment(...args);
    expect(blockedOnA.isBlocked).toBe(true);
    expect(blockedOnA.timeToBlockExpire).toBe(120);
    const blockedOnB = await instanceB.increment(...args);
    expect(blockedOnB.isBlocked).toBe(true);
    expect(blockedOnB.timeToBlockExpire).toBe(120);
    // Hits are frozen while blocked, like the in-memory default.
    expect(blockedOnB.totalHits).toBe(4);

    // Once the block lifts, the next hit starts a fresh window.
    redis.advance(120_000);
    const afterBlock = await instanceA.increment(...args);
    expect(afterBlock).toMatchObject({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('keeps separate buckets per throttler name', async () => {
    const redis = new FakeRedis();
    const storage = new RedisThrottlerStorage(redis as never, config);

    await storage.increment('key', 60_000, 1, 60_000, 'default');
    const other = await storage.increment('key', 60_000, 1, 60_000, 'sms');
    expect(other).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('fails open when Redis errors', async () => {
    const redis = new FakeRedis();
    redis.fail = true;
    const storage = new RedisThrottlerStorage(redis as never, config);

    await expect(
      storage.increment('key', 60_000, 5, 60_000, 'default'),
    ).resolves.toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('closes its own connection on shutdown', async () => {
    const redis = new FakeRedis();
    const storage = new RedisThrottlerStorage(redis as never, config);

    await storage.onModuleDestroy();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });
});
