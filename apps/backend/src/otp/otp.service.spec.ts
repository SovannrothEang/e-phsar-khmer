import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as nodeCrypto from 'node:crypto';
import type { PhoneOtpRow } from '../db/schema';
import type { OtpRepository } from './otp.repository';
import { OtpService } from './otp.service';
import type { OtpPurpose } from './otp.types';

// Pass-through wrappers so tests can observe timingSafeEqual and pin randomInt
// (node's crypto exports are not configurable, so spyOn cannot be used).
jest.mock('node:crypto', () => {
  const actual =
    jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    timingSafeEqual: jest.fn(actual.timingSafeEqual),
    randomInt: jest.fn(actual.randomInt),
  };
});

/**
 * In-memory stand-in for OtpRepository. There is no test database in this
 * repo, so this is a FAITHFUL FAKE: every method mirrors the conditional
 * UPDATE ... WHERE ... RETURNING of the real repository and, because JS is
 * single threaded, is atomic exactly as the SQL statement is in Postgres.
 * It proves the service logic and the call contract, not the SQL itself.
 */
class FakeRepo {
  rows: PhoneOtpRow[] = [];
  private seq = 0;

  replaceOpen = jest.fn(
    (input: {
      phone: string;
      purpose: OtpPurpose;
      codeHash: string;
      expiresAt: Date;
      requestIp: string | null;
    }): Promise<PhoneOtpRow> => {
      for (const r of this.rows) {
        if (
          r.phone === input.phone &&
          r.purpose === input.purpose &&
          !r.consumedAt
        ) {
          r.consumedAt = new Date();
        }
      }
      const row: PhoneOtpRow = {
        id: `otp-${++this.seq}`,
        attempts: 0,
        consumedAt: null,
        createdAt: new Date(Date.now() + this.seq),
        ...input,
      };
      this.rows.push(row);
      return Promise.resolve(row);
    },
  );

  findLatestOpen = (phone: string, purposes: OtpPurpose[]) => {
    const open = this.rows
      .filter(
        (r) =>
          r.phone === phone && purposes.includes(r.purpose) && !r.consumedAt,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve(open[0] ? { ...open[0] } : null);
  };

  reserveAttempt = (id: string, max: number) => {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.consumedAt || r.expiresAt.getTime() <= Date.now()) {
      return Promise.resolve(null);
    }
    if (r.attempts >= max) return Promise.resolve(null);
    r.attempts += 1;
    return Promise.resolve({ ...r });
  };

  consume = (id: string) => {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.consumedAt || r.expiresAt.getTime() <= Date.now()) {
      return Promise.resolve(false);
    }
    r.consumedAt = new Date();
    return Promise.resolve(true);
  };

  invalidate = (id: string) => {
    const r = this.rows.find((x) => x.id === id);
    if (r && !r.consumedAt) r.consumedAt = new Date();
    return Promise.resolve();
  };
}

function makeService(cfg: Record<string, unknown> = {}) {
  const repo = new FakeRepo();
  const config = {
    get: (k: string) =>
      k in cfg
        ? cfg[k]
        : k === 'jwt.secret'
          ? 'jwt-secret-for-tests-0123456789'
          : undefined,
  } as unknown as ConfigService;
  const service = new OtpService(repo as unknown as OtpRepository, config);
  return { repo, service };
}

const PHONE = '012345678';

describe('OtpService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('issues a 6-digit code that verifies once and then fails (single use)', async () => {
    const { service } = makeService();
    const { code } = await service.issue(PHONE, 'register');
    expect(code).toMatch(/^\d{6}$/);
    expect(await service.verify(PHONE, 'register', code)).toEqual({
      status: 'ok',
      purpose: 'register',
    });
    expect((await service.verify(PHONE, 'register', code)).status).toBe(
      'invalid',
    );
  });

  it('stores an HMAC hash, never the plain code', async () => {
    const { service, repo } = makeService();
    const { code } = await service.issue(PHONE, 'login', '1.2.3.4');
    const stored = JSON.stringify(repo.rows);
    expect(stored).not.toContain(code);
    expect(repo.rows[0].codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(repo.rows[0].requestIp).toBe('1.2.3.4');
  });

  it('rejects a wrong code, and a code for another phone', async () => {
    const { service } = makeService();
    const { code } = await service.issue(PHONE, 'login');
    const wrong = code === '000000' ? '000001' : '000000';
    expect((await service.verify(PHONE, 'login', wrong)).status).toBe(
      'invalid',
    );
    expect((await service.verify('099999999', 'login', code)).status).toBe(
      'invalid',
    );
  });

  it('fails an expired code', async () => {
    jest.useFakeTimers();
    try {
      const { service } = makeService();
      const { code } = await service.issue(PHONE, 'register');
      jest.setSystemTime(Date.now() + 5 * 60 * 1000 + 1000);
      expect((await service.verify(PHONE, 'register', code)).status).toBe(
        'expired',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('kills the code after 5 wrong attempts: the 6th fails even when correct', async () => {
    const { service } = makeService();
    const { code } = await service.issue(PHONE, 'login');
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) {
      expect((await service.verify(PHONE, 'login', wrong)).status).toBe(
        'invalid',
      );
    }
    expect((await service.verify(PHONE, 'login', code)).status).toBe(
      'too_many_attempts',
    );
  });

  it('a new issue kills the older open code for that phone and purpose', async () => {
    const { service } = makeService();
    const first = await service.issue(PHONE, 'register');
    const second = await service.issue(PHONE, 'register');
    if (first.code !== second.code) {
      expect((await service.verify(PHONE, 'register', first.code)).status).toBe(
        'invalid',
      );
    }
    expect((await service.verify(PHONE, 'register', second.code)).status).toBe(
      'ok',
    );
  });

  it('a new issue for another purpose leaves the existing code alone', async () => {
    const { service } = makeService();
    const reg = await service.issue(PHONE, 'register');
    await service.issue(PHONE, 'password_reset');
    expect((await service.verify(PHONE, 'register', reg.code)).status).toBe(
      'ok',
    );
  });

  it('accepts any of several purposes and reports which one matched', async () => {
    const { service } = makeService();
    const { code } = await service.issue(PHONE, 'login');
    expect(await service.verify(PHONE, ['register', 'login'], code)).toEqual({
      status: 'ok',
      purpose: 'login',
    });
  });

  it('two concurrent verifies of one correct code let exactly one through', async () => {
    const { service } = makeService();
    const { code } = await service.issue(PHONE, 'register');
    const results = await Promise.all([
      service.verify(PHONE, 'register', code),
      service.verify(PHONE, 'register', code),
      service.verify(PHONE, 'register', code),
    ]);
    expect(results.filter((r) => r.status === 'ok')).toHaveLength(1);
  });

  it('parallel wrong guesses never get more than 5 comparisons', async () => {
    const { service, repo } = makeService();
    const { code } = await service.issue(PHONE, 'login');
    const wrong = code === '000000' ? '000001' : '000000';
    await Promise.all(
      Array.from({ length: 20 }, () => service.verify(PHONE, 'login', wrong)),
    );
    expect(repo.rows[0].attempts).toBe(5);
    expect((await service.verify(PHONE, 'login', code)).status).toBe(
      'too_many_attempts',
    );
  });

  it('compares with timingSafeEqual on equal-length buffers only', async () => {
    const spy = jest.mocked(nodeCrypto.timingSafeEqual);
    spy.mockClear();
    const { service } = makeService();
    const { code } = await service.issue(PHONE, 'login');
    await service.verify(PHONE, 'login', code);
    expect(spy).toHaveBeenCalled();
    for (const [a, b] of spy.mock.calls) {
      expect((a as Buffer).length).toBe((b as Buffer).length);
    }
    // A wrong-length submission must not reach timingSafeEqual (it throws).
    const { code: c2 } = await service.issue('011111111', 'login');
    expect(c2).toBeDefined();
    await expect(
      service.verify('011111111', 'login', '12'),
    ).resolves.toMatchObject({ status: 'invalid' });
  });

  describe('secret handling', () => {
    it('uses OTP_HMAC_SECRET when set: different secrets give different hashes', async () => {
      const a = makeService({ 'otp.hmacSecret': 'a'.repeat(32) });
      const b = makeService({ 'otp.hmacSecret': 'b'.repeat(32) });
      jest
        .mocked(nodeCrypto.randomInt)
        .mockReturnValueOnce(123456 as never)
        .mockReturnValueOnce(123456 as never);
      await a.service.issue(PHONE, 'login');
      await b.service.issue(PHONE, 'login');
      expect(a.repo.rows[0].codeHash).not.toBe(b.repo.rows[0].codeHash);
    });

    it('falls back to a JWT-derived key, warns once and never logs the secret', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const { service } = makeService();
      await service.issue(PHONE, 'login');
      await service.issue('011111111', 'login');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).not.toContain(
        'jwt-secret-for-tests',
      );
    });
  });

  describe('DEV_OTP_TOKEN bypass', () => {
    it('works outside production: verify accepts it for any phone, issue stores nothing', async () => {
      const { service, repo } = makeService({
        devOtpToken: '123123',
        nodeEnv: 'development',
      });
      service.onModuleInit();
      const issued = await service.issue(PHONE, 'register');
      expect(issued.id).toBeNull();
      expect(repo.rows).toHaveLength(0);
      expect(
        (await service.verify('077777777', 'login', '123123')).status,
      ).toBe('ok');
      expect(
        (await service.verify('077777777', 'login', '999999')).status,
      ).toBe('invalid');
    });

    it('is refused in production, with an error log', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const { service, repo } = makeService({
        devOtpToken: '123123',
        nodeEnv: 'production',
      });
      service.onModuleInit();
      expect(error).toHaveBeenCalledTimes(1);
      expect(service.devBypassActive).toBe(false);
      const issued = await service.issue(PHONE, 'register');
      expect(issued.id).not.toBeNull();
      expect(repo.rows).toHaveLength(1);
      expect(
        (await service.verify(PHONE, 'register', '123123')).status,
      ).not.toBe('ok');
    });
  });

  it('exposes the provider switch, defaulting to supabase', () => {
    expect(makeService().service.provider).toBe('supabase');
    expect(makeService({ 'otp.provider': 'plasgate' }).service.provider).toBe(
      'plasgate',
    );
  });
});
