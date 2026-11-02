import { SmsRateLimiter } from './sms-rate-limiter';

function makeConfig(limit = 150) {
  return {
    get: (key: string) =>
      key === 'sms.rateLimitPerMinute' ? limit : undefined,
  } as unknown as import('@nestjs/config').ConfigService;
}

/**
 * Mirrors the real `eval` call the limiter makes (sliding-window sorted
 * set: drop entries older than the window, count what's left, admit if
 * under budget) entirely in memory — same algorithm the Lua script in
 * `sms-rate-limiter.ts` implements atomically in Redis, enough to exercise
 * the limiter's own decision logic without a real Redis server.
 */
class FakeRedis {
  private readonly entries: number[] = [];
  public failing = false;

  // Named `eval` to match ioredis's `Redis#eval()` client method (which
  // sends a Redis `EVAL` command running a Lua script server-side) — this
  // is a test double for that RPC, not a call to JavaScript's `eval()`;
  // no string here is ever interpreted as JS or Lua source.
  eval(
    _script: string,
    _numKeys: number,
    _key: string,
    now: string,
    windowMs: string,
    limit: string,
  ): Promise<number> {
    if (this.failing) return Promise.reject(new Error('ECONNREFUSED'));
    const nowNum = Number(now);
    const windowNum = Number(windowMs);
    const limitNum = Number(limit);
    const cutoff = nowNum - windowNum;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i] <= cutoff) this.entries.splice(i, 1);
    }
    if (this.entries.length < limitNum) {
      this.entries.push(nowNum);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }
}

describe('SmsRateLimiter', () => {
  it('allows requests under the budget', async () => {
    const redis = new FakeRedis();
    const limiter = new SmsRateLimiter(redis as never, makeConfig(3));

    expect(await limiter.tryAcquire()).toBe('allowed');
    expect(await limiter.tryAcquire()).toBe('allowed');
    expect(await limiter.tryAcquire()).toBe('allowed');
  });

  it('denies once the per-minute budget is exhausted', async () => {
    const redis = new FakeRedis();
    const limiter = new SmsRateLimiter(redis as never, makeConfig(2));

    expect(await limiter.tryAcquire()).toBe('allowed');
    expect(await limiter.tryAcquire()).toBe('allowed');
    expect(await limiter.tryAcquire()).toBe('over_budget');
  });

  it('frees capacity as the window slides', async () => {
    jest.useFakeTimers();
    const redis = new FakeRedis();
    const limiter = new SmsRateLimiter(redis as never, makeConfig(1));

    expect(await limiter.tryAcquire()).toBe('allowed');
    expect(await limiter.tryAcquire()).toBe('over_budget');

    jest.advanceTimersByTime(60_001);
    expect(await limiter.tryAcquire()).toBe('allowed');
    jest.useRealTimers();
  });

  it('fails closed (retry, not open) when Redis is unavailable', async () => {
    const redis = new FakeRedis();
    redis.failing = true;
    const limiter = new SmsRateLimiter(redis as never, makeConfig(150));

    expect(await limiter.tryAcquire()).toBe('unavailable');
  });
});
