import { SmsUserLimiter } from './sms-user-limiter';

function makeConfig(cooldown = 300, cap = 10) {
  return {
    get: (key: string) =>
      key === 'sms.userCooldownSeconds'
        ? cooldown
        : key === 'sms.userDailyCap'
          ? cap
          : undefined,
  } as unknown as import('@nestjs/config').ConfigService;
}

/**
 * In-memory mirror of the two Lua scripts (selected by their content). JS is
 * single-threaded so each `eval` is atomic here exactly as a script is in
 * Redis; this checks the decision logic and the call contract, not the Lua
 * syntax. Cooldown expiry is simulated via `expireCooldowns()`.
 */
class FakeRedis {
  readonly kv = new Map<string, string>();
  readonly counters = new Map<string, number>();
  fail = false;

  expireCooldowns(): void {
    this.kv.clear();
  }

  // `eval` is ioredis's `Redis#eval()` RPC, not JavaScript's `eval()`.
  eval(script: string, _n: number, ...args: string[]): Promise<number> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    const [cdKey, dayKey] = args;
    if (script.includes('INCR')) {
      const [eventId, , cap] = args.slice(2);
      const holder = this.kv.get(cdKey);
      if (holder === eventId) return Promise.resolve(1);
      if (holder !== undefined) return Promise.resolve(2);
      const n = (this.counters.get(dayKey) ?? 0) + 1;
      if (n > Number(cap)) return Promise.resolve(3);
      this.counters.set(dayKey, n);
      this.kv.set(cdKey, eventId);
      return Promise.resolve(1);
    }
    const [eventId] = args.slice(2);
    if (this.kv.get(cdKey) === eventId) {
      this.kv.delete(cdKey);
      this.counters.set(
        dayKey,
        Math.max(0, (this.counters.get(dayKey) ?? 0) - 1),
      );
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }
}

const slot = (eventId: string, type = 'auth.phone.verify', userId = 'u1') => ({
  userId,
  notificationType: type,
  eventId,
});

describe('SmsUserLimiter', () => {
  it('allows the first SMS and refuses a second of the same type inside the window', async () => {
    const limiter = new SmsUserLimiter(new FakeRedis() as never, makeConfig());
    expect(await limiter.acquire(slot('e1'))).toBe('allowed');
    expect(await limiter.acquire(slot('e2'))).toBe('cooldown');
  });

  it('does not block a different type for the same user', async () => {
    const limiter = new SmsUserLimiter(new FakeRedis() as never, makeConfig());
    expect(await limiter.acquire(slot('e1', 'auth.phone.verify'))).toBe(
      'allowed',
    );
    expect(await limiter.acquire(slot('e2', 'auth.password.reset'))).toBe(
      'allowed',
    );
  });

  it('does not block a different user', async () => {
    const limiter = new SmsUserLimiter(new FakeRedis() as never, makeConfig());
    expect(await limiter.acquire(slot('e1', undefined, 'u1'))).toBe('allowed');
    expect(await limiter.acquire(slot('e2', undefined, 'u2'))).toBe('allowed');
  });

  it('lets exactly one of several simultaneous requests through', async () => {
    const limiter = new SmsUserLimiter(new FakeRedis() as never, makeConfig());
    const results = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((id) => limiter.acquire(slot(id))),
    );
    expect(results.filter((r) => r === 'allowed')).toHaveLength(1);
    expect(results.filter((r) => r === 'cooldown')).toHaveLength(4);
  });

  it('refuses the 11th SMS of the day with daily_cap, and a refusal burns no cooldown', async () => {
    const redis = new FakeRedis();
    const limiter = new SmsUserLimiter(redis as never, makeConfig(300, 10));
    for (let i = 1; i <= 10; i++) {
      expect(await limiter.acquire(slot(`e${i}`))).toBe('allowed');
      redis.expireCooldowns(); // the 5-minute window passes between sends
    }
    expect(await limiter.acquire(slot('e11'))).toBe('daily_cap');
    expect(redis.kv.size).toBe(0);
  });

  it('treats a retry of the holding event as allowed without counting it twice', async () => {
    const redis = new FakeRedis();
    const limiter = new SmsUserLimiter(redis as never, makeConfig());
    expect(await limiter.acquire(slot('e1'))).toBe('allowed');
    expect(await limiter.acquire(slot('e1'))).toBe('allowed');
    expect([...redis.counters.values()]).toEqual([1]);
  });

  it('release frees the slot and the daily count, only for the holder', async () => {
    const redis = new FakeRedis();
    const limiter = new SmsUserLimiter(redis as never, makeConfig());
    await limiter.acquire(slot('e1'));
    await limiter.release(slot('someone-else'));
    expect(await limiter.acquire(slot('e2'))).toBe('cooldown');
    await limiter.release(slot('e1'));
    expect([...redis.counters.values()]).toEqual([0]);
    expect(await limiter.acquire(slot('e2'))).toBe('allowed');
  });

  it('fails closed when Redis errors, and release never throws', async () => {
    const redis = new FakeRedis();
    redis.fail = true;
    const limiter = new SmsUserLimiter(redis as never, makeConfig());
    expect(await limiter.acquire(slot('e1'))).toBe('unavailable');
    await expect(limiter.release(slot('e1'))).resolves.toBeUndefined();
  });

  it('passes the configured cooldown and cap to the script', async () => {
    const redis = new FakeRedis();
    const spy = jest.spyOn(redis, 'eval');
    const limiter = new SmsUserLimiter(redis as never, makeConfig(120, 3));
    await limiter.acquire(slot('e1'));
    const args = spy.mock.calls[0];
    expect(args[5]).toBe('120');
    expect(args[6]).toBe('3');
  });
});
