import { ServiceUnavailableException } from '@nestjs/common';
import {
  SOCIAL_STATE_PATTERN,
  SOCIAL_STATE_TTL_SECONDS,
  SocialStateService,
} from './social-state.service';

/**
 * In-memory stand-in for the two Redis commands the service issues. `clock`
 * lets a test age an entry without touching timers, and `fail` simulates the
 * outage path.
 */
class FakeStateRedis {
  private readonly entries = new Map<
    string,
    { value: string; expiresAt: number }
  >();
  clock = 1_700_000_000_000;
  fail = false;
  readonly sets: { key: string; value: string; seconds: number }[] = [];

  advance(ms: number): void {
    this.clock += ms;
  }

  set(key: string, value: string, _mode: 'EX', seconds: number): Promise<'OK'> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    this.sets.push({ key, value, seconds });
    this.entries.set(key, { value, expiresAt: this.clock + seconds * 1000 });
    return Promise.resolve('OK');
  }

  getdel(key: string): Promise<string | null> {
    if (this.fail) return Promise.reject(new Error('redis down'));
    const entry = this.entries.get(key);
    if (!entry) return Promise.resolve(null);
    this.entries.delete(key);
    if (entry.expiresAt <= this.clock) return Promise.resolve(null);
    return Promise.resolve(entry.value);
  }
}

function makeStateService(redis = new FakeStateRedis()) {
  const service = new SocialStateService(
    redis as never,
    {
      get: () => 'test',
    } as never,
  );
  return { service, redis };
}

describe('SocialStateService', () => {
  it('mints a state in the documented shape and remembers the provider', async () => {
    const { service, redis } = makeStateService();

    const state = await service.issue('google');

    expect(SOCIAL_STATE_PATTERN.test(state)).toBe(true);
    expect(redis.sets).toHaveLength(1);
    expect(redis.sets[0].value).toBe('google');
    expect(redis.sets[0].seconds).toBe(SOCIAL_STATE_TTL_SECONDS);
  });

  it('accepts the state exactly once for the provider it was minted for', async () => {
    const { service } = makeStateService();
    const state = await service.issue('google');

    await expect(service.consume(state, 'google')).resolves.toBe(true);
    // Single use: the nonce is gone, so a replayed callback cannot login.
    await expect(service.consume(state, 'google')).resolves.toBe(false);
  });

  it('rejects a state minted for another provider', async () => {
    const { service } = makeStateService();
    const state = await service.issue('google');

    await expect(service.consume(state, 'facebook')).resolves.toBe(false);
  });

  it('rejects a state that was never minted here', async () => {
    const { service } = makeStateService();

    await expect(service.consume('a'.repeat(32), 'google')).resolves.toBe(
      false,
    );
  });

  it('rejects an expired state', async () => {
    const { service, redis } = makeStateService();
    const state = await service.issue('google');

    redis.advance(SOCIAL_STATE_TTL_SECONDS * 1000 + 1);

    await expect(service.consume(state, 'google')).resolves.toBe(false);
  });

  it('rejects shapes that are not our nonces without touching Redis', async () => {
    const { service, redis } = makeStateService();
    const getdel = jest.spyOn(redis, 'getdel');

    await expect(service.consume('', 'google')).resolves.toBe(false);
    await expect(service.consume('short', 'google')).resolves.toBe(false);
    await expect(service.consume('../../etc/passwd', 'google')).resolves.toBe(
      false,
    );
    expect(getdel).not.toHaveBeenCalled();
  });

  it('fails closed when Redis is unavailable: no callback without a proven state', async () => {
    const { service, redis } = makeStateService();
    redis.fail = true;

    await expect(service.consume('a'.repeat(32), 'google')).resolves.toBe(
      false,
    );
  });

  it('refuses to start a flow it cannot record', async () => {
    const { service, redis } = makeStateService();
    redis.fail = true;

    await expect(service.issue('google')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
