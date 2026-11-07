import { HttpException } from '@nestjs/common';
import {
  ACCOUNT_LOCKOUT_TIERS,
  LOCKOUT_FAILURE_WINDOW_SECONDS,
  LoginLockoutService,
  lockDurationSeconds,
  normalizeLoginIdentifier,
} from './login-lockout.service';

/**
 * In-memory stand-in for the Redis commands the lockout issues. Expiry is
 * evaluated against `clock`, so a test can age a lock without timers. It is a
 * double for the call contract, not for Redis itself.
 */
class FakeRedis {
  private readonly entries = new Map<
    string,
    { value: number; expiresAt: number | null }
  >();
  clock = 1_700_000_000_000;
  fail = false;

  advance(ms: number): void {
    this.clock += ms;
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  incr(key: string): Promise<number> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    const entry = this.live(key);
    const value = (entry?.value ?? 0) + 1;
    this.entries.set(key, { value, expiresAt: entry?.expiresAt ?? null });
    return Promise.resolve(value);
  }

  expire(key: string, seconds: number): Promise<number> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    const entry = this.live(key);
    if (!entry) return Promise.resolve(0);
    entry.expiresAt = this.clock + seconds * 1000;
    return Promise.resolve(1);
  }

  pttl(key: string): Promise<number> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    const entry = this.live(key);
    if (!entry) return Promise.resolve(-2);
    return Promise.resolve(
      entry.expiresAt === null ? -1 : entry.expiresAt - this.clock,
    );
  }

  set(key: string, value: string, _mode: 'EX', seconds: number): Promise<'OK'> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    this.entries.set(key, {
      value: Number(value),
      expiresAt: this.clock + seconds * 1000,
    });
    return Promise.resolve('OK');
  }

  del(...keys: string[]): Promise<number> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    let removed = 0;
    for (const key of keys) {
      if (this.entries.delete(key)) removed++;
    }
    return Promise.resolve(removed);
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
}

function makeService(redis = new FakeRedis()) {
  return {
    redis,
    lockout: new LoginLockoutService(
      redis as never,
      {
        get: () => 'test',
      } as never,
    ),
  };
}

async function lockoutError(
  lockout: LoginLockoutService,
  identifier: string,
): Promise<HttpException | null> {
  try {
    await lockout.assertNotLocked(identifier);
    return null;
  } catch (err) {
    if (!(err instanceof HttpException)) throw err;
    return err;
  }
}

describe('LoginLockoutService', () => {
  it('applies the documented tiers: 5 → 60 s, 10 → 5 min, 15 → 15 min', () => {
    expect(ACCOUNT_LOCKOUT_TIERS).toEqual([
      { failures: 15, seconds: 900 },
      { failures: 10, seconds: 300 },
      { failures: 5, seconds: 60 },
    ]);
    expect(lockDurationSeconds(4)).toBe(0);
    expect(lockDurationSeconds(5)).toBe(60);
    expect(lockDurationSeconds(9)).toBe(60);
    expect(lockDurationSeconds(10)).toBe(300);
    expect(lockDurationSeconds(14)).toBe(300);
    expect(lockDurationSeconds(15)).toBe(900);
    expect(lockDurationSeconds(500)).toBe(900);
  });

  it('locks after five failures and reports retryAfterSeconds in the response', async () => {
    const { lockout } = makeService();

    for (let attempt = 0; attempt < 4; attempt++) {
      await lockout.recordFailure('SokDara');
    }
    expect(await lockoutError(lockout, 'sokdara')).toBeNull();

    await lockout.recordFailure('sokdara');
    const error = await lockoutError(lockout, 'SokDara');
    expect(error?.getStatus()).toBe(429);
    expect(error?.getResponse()).toEqual({
      code: 'ACCOUNT_LOCKED',
      message: 'Too many failed attempts. Please try again later.',
      retryAfterSeconds: 60,
    });
  });

  it('escalates to 5 minutes at ten failures and 15 minutes at fifteen', async () => {
    const { lockout } = makeService();

    for (let attempt = 0; attempt < 10; attempt++) {
      await lockout.recordFailure('sokdara');
    }
    expect(
      (await lockoutError(lockout, 'sokdara'))?.getResponse(),
    ).toMatchObject({ retryAfterSeconds: 300 });

    for (let attempt = 0; attempt < 5; attempt++) {
      await lockout.recordFailure('sokdara');
    }
    expect(
      (await lockoutError(lockout, 'sokdara'))?.getResponse(),
    ).toMatchObject({ retryAfterSeconds: 900 });
  });

  it('lets the lock expire without another failure', async () => {
    const { lockout, redis } = makeService();
    for (let attempt = 0; attempt < 5; attempt++) {
      await lockout.recordFailure('sokdara');
    }
    expect(await lockoutError(lockout, 'sokdara')).not.toBeNull();

    redis.advance(60_000);
    expect(await lockoutError(lockout, 'sokdara')).toBeNull();
  });

  it('shares one counter across identifier variants', async () => {
    const { lockout } = makeService();

    for (let attempt = 0; attempt < 3; attempt++) {
      await lockout.recordFailure('SokDara');
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      await lockout.recordFailure(' SOKDARA ');
    }

    expect(await lockoutError(lockout, 'sokdara')).not.toBeNull();
  });

  it('normalizes phone formats to one counter', async () => {
    expect(normalizeLoginIdentifier('+855 12 345 678')).toBe('85512345678');
    expect(normalizeLoginIdentifier('855-123-456-78')).toBe('85512345678');

    const { lockout } = makeService();
    for (let attempt = 0; attempt < 5; attempt++) {
      await lockout.recordFailure('+855 12 345 678');
    }
    expect(await lockoutError(lockout, '85512345678')).not.toBeNull();
  });

  it('does not lock a different identifier', async () => {
    const { lockout } = makeService();
    for (let attempt = 0; attempt < 5; attempt++) {
      await lockout.recordFailure('victim');
    }
    expect(await lockoutError(lockout, 'victim')).not.toBeNull();
    expect(await lockoutError(lockout, 'bystander')).toBeNull();
  });

  it('resets the counter and the lock on success', async () => {
    const { lockout } = makeService();
    for (let attempt = 0; attempt < 5; attempt++) {
      await lockout.recordFailure('sokdara');
    }
    expect(await lockoutError(lockout, 'sokdara')).not.toBeNull();

    await lockout.reset('sokdara');

    expect(await lockoutError(lockout, 'sokdara')).toBeNull();
    // The failures key is gone too: the next failure starts a fresh count.
    for (let attempt = 0; attempt < 4; attempt++) {
      await lockout.recordFailure('sokdara');
    }
    expect(await lockoutError(lockout, 'sokdara')).toBeNull();
  });

  it('keeps the raw identifier out of the Redis keys', async () => {
    const { lockout, redis } = makeService();
    await lockout.recordFailure('SokDara@Example.com');

    expect(redis.keys()).not.toHaveLength(0);
    for (const key of redis.keys()) {
      expect(key).not.toContain('sokdara');
      expect(key).not.toContain('example');
    }
  });

  it('fails open when Redis is unavailable', async () => {
    const { lockout, redis } = makeService();
    redis.fail = true;

    await expect(lockout.assertNotLocked('sokdara')).resolves.toBeUndefined();
    await expect(lockout.recordFailure('sokdara')).resolves.toBeUndefined();
    await expect(lockout.reset('sokdara')).resolves.toBeUndefined();
  });

  it('counts failures for LOCKOUT_FAILURE_WINDOW_SECONDS', async () => {
    const { lockout, redis } = makeService();
    await lockout.recordFailure('sokdara');

    // The counter (not the lock) is what the window applies to.
    const failuresKey = redis.keys().find((key) => key.includes('fail'));
    expect(failuresKey).toBeDefined();
    expect(await redis.pttl(failuresKey as string)).toBe(
      LOCKOUT_FAILURE_WINDOW_SECONDS * 1000,
    );
  });
});
