import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtStrategy } from './strategies/jwt.strategy';
import { bannedPhones } from '../db/schema/reports.schema';
import type { UserRow } from '../db/schema/users.schema';
import type { PhoneOtpRow } from '../db/schema';
import { OtpService } from '../otp/otp.service';
import type { OtpRepository } from '../otp/otp.repository';
import type { OtpPurpose } from '../otp/otp.types';

/**
 * End-to-end through AuthService + JwtStrategy + a REAL OtpService (hashing,
 * attempts, single use) and real bcrypt/JWTs. Only the database, the limiter
 * and PlasGate are in-memory fakes; the fakes read the bound parameters out of
 * drizzle's `where()` objects, so a query for another phone finds nothing.
 */

const PHONE = '+85512345678';
const UNKNOWN = '+85599999999';
const OLD_PASSWORD = 'old-password-1';
const NEW_PASSWORD = 'brand-new-pass-2';

interface Device {
  sessionId: string;
  userId: string;
  revokedAt: Date | null;
}

function paramsOf(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    node.forEach((n) => paramsOf(n, out));
  } else if (node && typeof node === 'object') {
    const obj = node as { queryChunks?: unknown[]; value?: unknown };
    if (obj.queryChunks) paramsOf(obj.queryChunks, out);
    else if (node.constructor.name === 'Param') out.push(obj.value);
  }
  return out;
}

class FakeOtpRepo {
  rows: PhoneOtpRow[] = [];
  replaceOpen = (input: {
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
      id: randomUUID(),
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
      ...input,
    };
    this.rows.push(row);
    return Promise.resolve(row);
  };
  findLatestOpen = (
    phone: string,
    purposes: OtpPurpose[],
  ): Promise<PhoneOtpRow | null> =>
    Promise.resolve(
      [...this.rows]
        .reverse()
        .find(
          (r) =>
            r.phone === phone && purposes.includes(r.purpose) && !r.consumedAt,
        ) ?? null,
    );
  reserveAttempt = (id: string, max: number): Promise<PhoneOtpRow | null> => {
    const row = this.rows.find((r) => r.id === id);
    if (!row || row.consumedAt || row.attempts >= max)
      return Promise.resolve(null);
    row.attempts += 1;
    return Promise.resolve(row);
  };
  consume = (id: string): Promise<boolean> => {
    const row = this.rows.find((r) => r.id === id);
    if (!row || row.consumedAt) return Promise.resolve(false);
    row.consumedAt = new Date();
    return Promise.resolve(true);
  };
  invalidate = (id: string): Promise<void> => {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.consumedAt = new Date();
    return Promise.resolve();
  };
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: randomUUID(),
    username: 'sokdara',
    passwordHash: null,
    primaryPhone: PHONE,
    role: 'user',
    status: 'active',
    deletedAt: null,
    tokensValidAfter: null,
    updatedAt: new Date(),
    ...overrides,
  } as UserRow;
}

async function setup(
  opts: {
    provider?: 'plasgate' | 'supabase';
    user?: Partial<UserRow>;
    notifyFails?: boolean;
  } = {},
) {
  const user = makeUser({
    passwordHash: await bcrypt.hash(OLD_PASSWORD, 4),
    ...opts.user,
  });
  const store = {
    users: [user],
    banned: [] as string[],
    devices: [] as Device[],
  };

  const select = () => ({
    from: (table: unknown) => {
      const rowsFor = (cond: unknown, joinCond?: unknown): unknown[] => {
        const params = paramsOf(cond);
        if (table === bannedPhones) {
          return store.banned.some((p) => params.includes(p))
            ? [{ id: 'ban' }]
            : [];
        }
        // Soft-deleted rows are invisible to queries filtering `deletedAt`.
        const found = store.users.filter(
          (u) =>
            !u.deletedAt &&
            [u.id, u.username, u.primaryPhone].some((v) => params.includes(v)),
        );
        if (!joinCond) return found;
        const sids = paramsOf(joinCond);
        return found.flatMap((u) => {
          const d = store.devices.find(
            (x) => x.userId === u.id && sids.includes(x.sessionId),
          );
          return d ? [{ ...u, revokedAt: d.revokedAt }] : [];
        });
      };
      const where = (cond: unknown, joinCond?: unknown) => ({
        limit: () => Promise.resolve(rowsFor(cond, joinCond)),
      });
      return {
        where: (c: unknown) => where(c),
        innerJoin: (_t: unknown, joinCond: unknown) => ({
          where: (c: unknown) => where(c, joinCond),
        }),
      };
    },
  });
  const update = () => ({
    set: (data: Partial<UserRow>) => ({
      where: (cond: unknown) => {
        const params = paramsOf(cond);
        for (const u of store.users) {
          if (params.includes(u.id)) Object.assign(u, data);
        }
        return Promise.resolve([]);
      },
    }),
  });
  const db = { select, update };

  const loginDevices = {
    recordLogin: jest.fn((userId: string, device: { id: string } | null) => {
      if (!device)
        return Promise.resolve({ isNewDevice: false, sessionId: null });
      const sessionId = randomUUID();
      store.devices.push({ sessionId, userId, revokedAt: null });
      return Promise.resolve({ isNewDevice: false, sessionId });
    }),
    findSessionByDeviceId: jest.fn().mockResolvedValue(null),
    touchActiveSession: jest.fn((userId: string, sid: string) =>
      Promise.resolve(
        store.devices.some(
          (d) => d.userId === userId && d.sessionId === sid && !d.revokedAt,
        ),
      ),
    ),
    revokeAllForUser: jest.fn((userId: string) => {
      for (const d of store.devices) {
        if (d.userId === userId && !d.revokedAt) {
          d.revokedAt = new Date();
          d.sessionId = randomUUID();
        }
      }
      return Promise.resolve({ revoked: 1 });
    }),
  };

  const config = {
    'jwt.secret': 'access-secret-access-secret',
    'jwt.refreshSecret': 'refresh-secret-refresh-secret',
    'jwt.accessExpiresIn': '15m',
    'jwt.refreshExpiresIn': '30d',
    'otp.provider': opts.provider ?? 'plasgate',
    'otp.hmacSecret': 'hmac-secret-hmac-secret',
    'sms.userCooldownSeconds': 300,
  } as Record<string, unknown>;
  const configService = { get: (k: string) => config[k] ?? null };

  const repo = new FakeOtpRepo();
  const otp = new OtpService(
    repo as unknown as OtpRepository,
    {
      get: (k: string) => config[k],
    } as never,
  );

  // Stand-in for OtpSmsSender: same cooldown behaviour for real and phantom
  // sends, records every SMS that would reach PlasGate.
  const sms: { phone: string; purpose: OtpPurpose; code: string }[] = [];
  const cooling = new Set<string>();
  const sender = {
    issueAndSendDetached: jest.fn(
      async (phone: string, purpose: OtpPurpose) => {
        if (cooling.has(phone))
          return {
            result: { status: 'cooldown' as const, retryAfterSeconds: 120 },
            delivery: Promise.resolve(),
          };
        cooling.add(phone);
        const issued = await otp.issue(phone, purpose, null);
        sms.push({ phone, purpose, code: issued.code });
        return {
          result: { status: 'sent' as const, retryAfterSeconds: 300 },
          delivery: Promise.resolve(),
        };
      },
    ),
    reserveOnly: jest.fn((phone: string) => {
      if (cooling.has(phone))
        return Promise.resolve({
          status: 'cooldown' as const,
          retryAfterSeconds: 120,
        });
      cooling.add(phone);
      return Promise.resolve({
        status: 'sent' as const,
        retryAfterSeconds: 300,
      });
    }),
  };

  const notifications = {
    notify: jest.fn(() =>
      opts.notifyFails
        ? Promise.reject(new Error('notify down'))
        : Promise.resolve(),
    ),
  };

  const jwt = new JwtService({ secret: config['jwt.secret'] as string });
  const service = new AuthService(
    db as never,
    jwt,
    configService as never,
    {} as never,
    loginDevices as never,
    otp,
    sender as never,
    notifications as never,
  );
  const strategy = new JwtStrategy(configService as never, db as never);
  const bearer = (token: string) => strategy.validate(jwt.decode(token));

  return {
    db,
    user,
    store,
    repo,
    service,
    strategy,
    bearer,
    sender,
    sms,
    notifications,
    loginDevices,
    otp,
  };
}

const DEVICE = { id: 'dev-1', name: 'Phone' };

describe('forgot password / reset', () => {
  let timeBase: number;
  beforeEach(() => {
    timeBase = Date.now();
    jest.useFakeTimers({
      now: timeBase,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
        'performance',
        'hrtime',
      ],
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('POST /auth/password/forgot', () => {
    it('answers the same body for a known and an unknown number, SMS only for the known one', async () => {
      const known = await setup();
      const unknown = await setup();

      const a = await known.service.requestPasswordReset({ phone: PHONE });
      const b = await unknown.service.requestPasswordReset({ phone: UNKNOWN });

      expect(a).toEqual({ otpSent: true, retryAfterSeconds: 300 });
      expect(b).toEqual(a);
      expect(known.sms).toHaveLength(1);
      expect(known.sms[0]).toMatchObject({
        phone: PHONE,
        purpose: 'password_reset',
      });
      expect(unknown.sms).toHaveLength(0);
      expect(unknown.sender.issueAndSendDetached).not.toHaveBeenCalled();
      expect(unknown.repo.rows).toHaveLength(0);
    });

    it.each([
      ['suspended', { status: 'suspended' as const }],
      ['soft-deleted', { deletedAt: new Date() }],
      ['without a password', { passwordHash: null }],
    ])(
      'sends nothing for a %s account and answers the same',
      async (_n, user) => {
        const ctx = await setup({ user });
        const res = await ctx.service.requestPasswordReset({ phone: PHONE });
        expect(res).toEqual({ otpSent: true, retryAfterSeconds: 300 });
        expect(ctx.sms).toHaveLength(0);
      },
    );

    it('sends nothing for a banned number and answers the same', async () => {
      const ctx = await setup();
      ctx.store.banned.push(PHONE);
      const res = await ctx.service.requestPasswordReset({ phone: PHONE });
      expect(res).toEqual({ otpSent: true, retryAfterSeconds: 300 });
      expect(ctx.sms).toHaveLength(0);
    });

    it('refuses a repeat inside the cooldown identically for known and unknown numbers', async () => {
      const known = await setup();
      const unknown = await setup();
      await known.service.requestPasswordReset({ phone: PHONE });
      await unknown.service.requestPasswordReset({ phone: UNKNOWN });

      const errA = await known.service
        .requestPasswordReset({ phone: PHONE })
        .catch((e: unknown) => e);
      const errB = await unknown.service
        .requestPasswordReset({ phone: UNKNOWN })
        .catch((e: unknown) => e);

      expect((errA as { getStatus(): number }).getStatus()).toBe(429);
      expect((errB as { getStatus(): number }).getStatus()).toBe(429);
      expect((errB as { getResponse(): unknown }).getResponse()).toEqual(
        (errA as { getResponse(): unknown }).getResponse(),
      );
      expect((errA as { getResponse(): unknown }).getResponse()).toMatchObject({
        code: 'OTP_COOLDOWN',
        retryAfterSeconds: 120,
      });
    });

    it('does the same two lookups for every number', async () => {
      const ctx = await setup();
      const selectSpy = jest.spyOn(ctx.db, 'select');
      await ctx.service.requestPasswordReset({ phone: PHONE });
      const known = selectSpy.mock.calls.length;
      selectSpy.mockClear();
      await ctx.service.requestPasswordReset({ phone: UNKNOWN });
      expect(selectSpy.mock.calls.length).toBe(known);
      expect(known).toBe(2);
    });

    it('returns 503 OTP_PROVIDER_UNSUPPORTED under the supabase provider', async () => {
      const ctx = await setup({ provider: 'supabase' });
      await expect(
        ctx.service.requestPasswordReset({ phone: PHONE }),
      ).rejects.toMatchObject({
        status: 503,
        response: { code: 'OTP_PROVIDER_UNSUPPORTED' },
      });
      await expect(
        ctx.service.resetPassword({
          phone: PHONE,
          code: '123456',
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toMatchObject({
        status: 503,
        response: { code: 'OTP_PROVIDER_UNSUPPORTED' },
      });
      expect(ctx.sender.issueAndSendDetached).not.toHaveBeenCalled();
      expect(ctx.sender.reserveOnly).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/password/reset', () => {
    async function requested() {
      const ctx = await setup();
      await ctx.service.requestPasswordReset({ phone: PHONE });
      return { ...ctx, code: ctx.sms[0].code };
    }

    it('resets the password: the old one stops working, the new one works, no auto-login', async () => {
      const ctx = await requested();
      const res = await ctx.service.resetPassword({
        phone: PHONE,
        code: ctx.code,
        newPassword: NEW_PASSWORD,
      });
      expect(res).toEqual({ reset: true });

      await expect(
        ctx.service.loginWithPassword({
          identifier: PHONE,
          password: OLD_PASSWORD,
        }),
      ).rejects.toMatchObject({ message: 'INVALID_CREDENTIALS' });
      const login = await ctx.service.loginWithPassword({
        identifier: PHONE,
        password: NEW_PASSWORD,
      });
      expect(login.accessToken).toEqual(expect.any(String));
      expect(res).not.toHaveProperty('accessToken');
    });

    it('rejects a wrong code with 401, leaves the password, and counts the attempt', async () => {
      const ctx = await requested();
      const err = await ctx.service
        .resetPassword({
          phone: PHONE,
          code: ctx.code === '000000' ? '111111' : '000000',
          newPassword: NEW_PASSWORD,
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toBe(
        'Invalid or expired OTP',
      );
      expect(ctx.repo.rows[0].attempts).toBe(1);
      await expect(
        ctx.service.loginWithPassword({
          identifier: PHONE,
          password: OLD_PASSWORD,
        }),
      ).resolves.toBeDefined();
    });

    it('kills the code after 5 wrong guesses even for the right code', async () => {
      const ctx = await requested();
      const wrong = ctx.code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) {
        await expect(
          ctx.service.resetPassword({
            phone: PHONE,
            code: wrong,
            newPassword: NEW_PASSWORD,
          }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
      await expect(
        ctx.service.resetPassword({
          phone: PHONE,
          code: ctx.code,
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toMatchObject({ message: 'Invalid or expired OTP' });
    });

    it('answers a known number exactly like an unknown one through a full attempt exhaustion', async () => {
      const ctx = await requested();
      const wrong = ctx.code === '000000' ? '111111' : '000000';
      const attempt = async (phone: string): Promise<UnauthorizedException> =>
        (await ctx.service
          .resetPassword({ phone, code: wrong, newPassword: NEW_PASSWORD })
          .catch((e: unknown) => e)) as UnauthorizedException;

      const known: unknown[] = [];
      for (let i = 0; i < 6; i++)
        known.push((await attempt(PHONE)).getResponse());
      // The exhaustion branch was really reached, not sidestepped.
      expect(ctx.repo.rows[0].attempts).toBe(5);

      const unknown: unknown[] = [];
      for (let i = 0; i < 6; i++) {
        unknown.push((await attempt(UNKNOWN)).getResponse());
      }

      expect(known).toEqual(unknown);
      for (const response of known) {
        expect(response).toEqual(
          expect.objectContaining({ message: 'Invalid or expired OTP' }),
        );
        // No domain code may ever distinguish the exhausted path.
        expect(response).not.toHaveProperty('code');
      }
    });

    it('rejects a reused code', async () => {
      const ctx = await requested();
      const dto = { phone: PHONE, code: ctx.code, newPassword: NEW_PASSWORD };
      await ctx.service.resetPassword(dto);
      await expect(
        ctx.service.resetPassword({ ...dto, newPassword: 'another-pass-3' }),
      ).rejects.toMatchObject({ message: 'Invalid or expired OTP' });
      await expect(
        ctx.service.loginWithPassword({
          identifier: PHONE,
          password: NEW_PASSWORD,
        }),
      ).resolves.toBeDefined();
    });

    it('rejects an expired code', async () => {
      const ctx = await requested();
      jest.setSystemTime(timeBase + 6 * 60 * 1000);
      await expect(
        ctx.service.resetPassword({
          phone: PHONE,
          code: ctx.code,
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toMatchObject({ message: 'Invalid or expired OTP' });
    });

    it('answers an unknown number exactly like a wrong code', async () => {
      const ctx = await setup();
      await expect(
        ctx.service.resetPassword({
          phone: UNKNOWN,
          code: '123456',
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toMatchObject({ message: 'Invalid or expired OTP' });
    });

    it('a code that arrived before the account was suspended cannot reset', async () => {
      const ctx = await requested();
      ctx.user.status = 'suspended';
      await expect(
        ctx.service.resetPassword({
          phone: PHONE,
          code: ctx.code,
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toMatchObject({ message: 'Invalid or expired OTP' });
      expect(await bcrypt.compare(OLD_PASSWORD, ctx.user.passwordHash!)).toBe(
        true,
      );
    });

    it('a code that arrived before the number was banned cannot reset', async () => {
      const ctx = await requested();
      ctx.store.banned.push(PHONE);
      await expect(
        ctx.service.resetPassword({
          phone: PHONE,
          code: ctx.code,
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toMatchObject({ message: 'Invalid or expired OTP' });
      expect(await bcrypt.compare(OLD_PASSWORD, ctx.user.passwordHash!)).toBe(
        true,
      );
    });

    it('does not fail the reset when the notification throws, and leaks no secrets into it', async () => {
      const ctx = await setup({ notifyFails: true });
      await ctx.service.requestPasswordReset({ phone: PHONE });
      const code = ctx.sms[0].code;
      await expect(
        ctx.service.resetPassword({
          phone: PHONE,
          code,
          newPassword: NEW_PASSWORD,
        }),
      ).resolves.toEqual({ reset: true });
      const payload = JSON.stringify(
        (ctx.notifications.notify.mock.calls as unknown[][])[0][0],
      );
      expect(payload).toContain('security.password_changed');
      expect(payload).not.toContain(NEW_PASSWORD);
      expect(payload).not.toContain(code);
    });
  });

  describe('session revocation', () => {
    it('rejects old access and refresh tokens (with and without sid) and accepts a new one', async () => {
      const ctx = await setup();
      // Token WITH a sid (device headers) and one WITHOUT (no headers).
      const withSid = await ctx.service.loginWithPassword(
        { identifier: PHONE, password: OLD_PASSWORD },
        DEVICE as never,
      );
      const noSid = await ctx.service.loginWithPassword({
        identifier: PHONE,
        password: OLD_PASSWORD,
      });
      const sidOf = (token: string): string | undefined =>
        new JwtService().decode<{ sid?: string }>(token).sid;
      expect(sidOf(withSid.accessToken)).toBeDefined();
      expect(sidOf(noSid.accessToken)).toBeUndefined();
      // Both work before the reset.
      await expect(ctx.bearer(withSid.accessToken)).resolves.toBeDefined();
      await expect(ctx.bearer(noSid.accessToken)).resolves.toBeDefined();

      jest.setSystemTime(timeBase + 60_000);
      await ctx.service.requestPasswordReset({ phone: PHONE });
      await ctx.service.resetPassword({
        phone: PHONE,
        code: ctx.sms[0].code,
        newPassword: NEW_PASSWORD,
      });
      expect(ctx.loginDevices.revokeAllForUser).toHaveBeenCalledWith(
        ctx.user.id,
      );

      jest.setSystemTime(timeBase + 120_000);
      await expect(ctx.bearer(withSid.accessToken)).rejects.toThrow(
        'Session revoked',
      );
      await expect(ctx.bearer(noSid.accessToken)).rejects.toThrow(
        'Session revoked',
      );
      await expect(
        ctx.service.refresh({ refreshToken: withSid.refreshToken }),
      ).rejects.toThrow('Session revoked');
      await expect(
        ctx.service.refresh({ refreshToken: noSid.refreshToken }),
      ).rejects.toThrow('Session revoked');

      // A token issued after the reset works, and so does its refresh.
      const fresh = await ctx.service.loginWithPassword(
        { identifier: PHONE, password: NEW_PASSWORD },
        DEVICE as never,
      );
      await expect(ctx.bearer(fresh.accessToken)).resolves.toMatchObject({
        id: ctx.user.id,
      });
      const refreshed = await ctx.service.refresh({
        refreshToken: fresh.refreshToken,
      });
      await expect(ctx.bearer(refreshed.accessToken)).resolves.toBeDefined();
    });

    it('a sid-less token issued in the same second as the reset still works (no lockout of the next login)', async () => {
      const ctx = await setup();
      await ctx.service.requestPasswordReset({ phone: PHONE });
      await ctx.service.resetPassword({
        phone: PHONE,
        code: ctx.sms[0].code,
        newPassword: NEW_PASSWORD,
      });
      const fresh = await ctx.service.loginWithPassword({
        identifier: PHONE,
        password: NEW_PASSWORD,
      });
      await expect(ctx.bearer(fresh.accessToken)).resolves.toBeDefined();
    });
  });

  describe('wiring', () => {
    it('throttles both routes like the other OTP endpoints', () => {
      const limit = (name: 'forgotPassword' | 'resetPassword') =>
        Reflect.getMetadata(
          'THROTTLER:LIMITdefault',
          AuthController.prototype[name],
        ) as number;
      expect(limit('forgotPassword')).toBe(5);
      expect(limit('resetPassword')).toBe(10);
      expect(
        Reflect.getMetadata(
          'THROTTLER:TTLdefault',
          (AuthController.prototype as unknown as Record<string, object>)
            .forgotPassword,
        ),
      ).toBe(60_000);
    });

    it('validates newPassword with the register rules (min 8, bcrypt max 72)', async () => {
      const check = async (newPassword: string) =>
        validate(
          plainToInstance(ResetPasswordDto, {
            phone: PHONE,
            code: '123456',
            newPassword,
          }),
        );
      expect(await check('short')).not.toHaveLength(0);
      expect(await check('x'.repeat(73))).not.toHaveLength(0);
      expect(await check(NEW_PASSWORD)).toHaveLength(0);
    });
  });
});
