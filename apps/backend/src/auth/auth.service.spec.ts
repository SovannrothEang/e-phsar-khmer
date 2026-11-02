import {
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import type { UserRow } from '../db/schema/users.schema';

jest.mock('bcrypt');

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-uuid',
    username: 'testuser',
    passwordHash: '$2b$10$hashedpassword',
    primaryPhone: null,
    email: null,
    firstName: null,
    lastName: null,
    gender: null,
    dateOfBirth: null,
    yearOfBirth: null,
    company: null,
    coverPhotoUrl: null,
    profilePhotoUrl: null,
    provinceId: null,
    districtId: null,
    communeId: null,
    address: null,
    latitude: null,
    longitude: null,
    preferredLanguage: 'en',
    role: 'user',
    status: 'active',
    isBusiness: false,
    discoverableByGender: false,
    discoverableByDateOfBirth: false,
    discoverableByPhone: true,
    discoverableByEmail: true,
    discoverableByLocation: true,
    lastSeenAt: null,
    emailVerifiedAt: null,
    tokensValidAfter: null,
    phoneVerifiedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDb() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    // Default no-op chain so a call this test doesn't care about (e.g.
    // `stampPhoneVerified`'s own UPDATE) never throws on an un-mocked
    // `.set()`/`.where()`; tests asserting a specific UPDATE still override
    // this with their own `mockImplementation`.
    update: jest.fn().mockImplementation(() => ({
      set: () => ({ where: () => Promise.resolve([]) }),
    })),
    delete: jest.fn(),
  };
}

function makeJwtService() {
  return {
    sign: jest.fn().mockReturnValue('signed-token'),
    verifyAsync: jest.fn(),
  };
}

function makeConfigService(values: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => values[key] ?? null),
  };
}

function makeLoginDevices() {
  return {
    recordLogin: jest
      .fn()
      .mockResolvedValue({ isNewDevice: false, sessionId: null }),
    findSessionByDeviceId: jest.fn().mockResolvedValue(null),
    touchActiveSession: jest.fn().mockResolvedValue(true),
  };
}

function makeOtpService() {
  return { verify: jest.fn() };
}

function makeOtpSender() {
  return { issueAndSend: jest.fn() };
}

function makeSupabase(overrides: Record<string, jest.Mock> = {}) {
  return {
    getUser: jest.fn(),
    signInWithOAuth: jest.fn(),
    ...overrides,
  };
}

function makeService(
  db: ReturnType<typeof makeDb>,
  jwtService: ReturnType<typeof makeJwtService>,
  configService: ReturnType<typeof makeConfigService>,
  loginDevices = makeLoginDevices(),
  supabaseService = makeSupabase(),
) {
  return new AuthService(
    db as never,
    jwtService as never,
    configService as never,
    supabaseService as never,
    loginDevices as never,
    makeOtpService() as never,
    makeOtpSender() as never,
    { notify: jest.fn() } as never,
  );
}

describe('AuthService', () => {
  describe('issueTokens', () => {
    it('signs JWT with only sub and role — no provider field', () => {
      const db = makeDb();
      const jwtService = makeJwtService();
      const configService = makeConfigService({
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '30d',
        'jwt.refreshSecret': 'refresh-secret',
      });
      const service = makeService(db, jwtService, configService);

      const user = makeUser();
      (service as unknown as { issueTokens(u: UserRow): unknown }).issueTokens(
        user,
      );

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const firstCallPayload = jwtService.sign.mock.calls[0][0];
      expect(firstCallPayload).toEqual({ sub: 'user-uuid', role: 'user' });
      expect(firstCallPayload).not.toHaveProperty('provider');
    });

    it('adds the device session id as sid when one is recorded', () => {
      const jwtService = makeJwtService();
      const service = makeService(
        makeDb(),
        jwtService,
        makeConfigService({
          'jwt.accessExpiresIn': '15m',
          'jwt.refreshExpiresIn': '30d',
          'jwt.refreshSecret': 'refresh-secret',
        }),
      );

      (
        service as unknown as {
          issueTokens(u: UserRow, sessionId: string | null): unknown;
        }
      ).issueTokens(makeUser(), 'session-1');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const firstCallPayload = jwtService.sign.mock.calls[0][0];
      expect(firstCallPayload).toEqual({
        sub: 'user-uuid',
        role: 'user',
        sid: 'session-1',
      });
    });
  });

  describe('loginWithPassword', () => {
    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('throws UnauthorizedException when user has deletedAt set', async () => {
      const deletedUser = makeUser({ deletedAt: new Date() });
      const db = makeDb();
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([deletedUser]) }),
        }),
      });

      const service = makeService(db, makeJwtService(), makeConfigService());

      await expect(
        service.loginWithPassword({ identifier: 'testuser', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('includes "deactivated" message for deleted accounts', async () => {
      const deletedUser = makeUser({ deletedAt: new Date() });
      const db = makeDb();
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([deletedUser]) }),
        }),
      });

      const service = makeService(db, makeJwtService(), makeConfigService());

      await expect(
        service.loginWithPassword({ identifier: 'testuser', password: 'pass' }),
      ).rejects.toThrow('Account deactivated');
    });

    it('records the device and returns newDevice from the login result', async () => {
      const user = makeUser();
      const db = makeDb();
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([user]) }),
        }),
      });
      const loginDevices = makeLoginDevices();
      loginDevices.recordLogin.mockResolvedValue({
        isNewDevice: true,
        sessionId: 'session-1',
      });
      const service = makeService(
        db,
        makeJwtService(),
        makeConfigService(),
        loginDevices,
      );
      const device = { id: 'device-12345678', name: 'Chrome on Linux' };

      const result = await service.loginWithPassword(
        { identifier: 'testuser', password: 'pass' },
        device,
      );

      expect(result.newDevice).toBe(true);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('tokensValidAfter');
      expect(loginDevices.recordLogin).toHaveBeenCalledWith(user.id, device);
    });

    it('does not record a device when the password is wrong', async () => {
      const user = makeUser();
      const db = makeDb();
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([user]) }),
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const loginDevices = makeLoginDevices();
      const service = makeService(
        db,
        makeJwtService(),
        makeConfigService(),
        loginDevices,
      );

      await expect(
        service.loginWithPassword({
          identifier: 'testuser',
          password: 'wrong-pass',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(loginDevices.recordLogin).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService refresh', () => {
  const SID = '00000000-0000-4000-8000-000000000001';

  function makeRefreshService() {
    const db = makeDb();
    db.select.mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([makeUser()]) }),
      }),
    });
    const jwtService = makeJwtService();
    const loginDevices = makeLoginDevices();
    const service = makeService(
      db,
      jwtService,
      makeConfigService({
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '30d',
        'jwt.refreshSecret': 'refresh-secret',
      }),
      loginDevices,
    );
    return { service, jwtService, loginDevices };
  }

  it('reissues tokens with the same sid and touches the row', async () => {
    const { service, jwtService, loginDevices } = makeRefreshService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      role: 'user',
      sid: SID,
    });

    await service.refresh({ refreshToken: 'token' });

    expect(loginDevices.touchActiveSession).toHaveBeenCalledWith(
      'user-uuid',
      SID,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const firstCallPayload = jwtService.sign.mock.calls[0][0];
    expect(firstCallPayload).toEqual({
      sub: 'user-uuid',
      role: 'user',
      sid: SID,
    });
  });

  it('rejects a sid whose device row was revoked', async () => {
    const { service, jwtService, loginDevices } = makeRefreshService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      role: 'user',
      sid: SID,
    });
    loginDevices.touchActiveSession.mockResolvedValue(false);

    await expect(service.refresh({ refreshToken: 'token' })).rejects.toThrow(
      'Session revoked',
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('rejects a malformed sid before querying', async () => {
    const { service, jwtService, loginDevices } = makeRefreshService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      role: 'user',
      sid: 'not-a-uuid',
    });

    await expect(service.refresh({ refreshToken: 'token' })).rejects.toThrow(
      'Invalid session',
    );
    expect(loginDevices.touchActiveSession).not.toHaveBeenCalled();
  });

  it('binds a legacy refresh token to an active device row', async () => {
    const { service, jwtService, loginDevices } = makeRefreshService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      role: 'user',
    });
    loginDevices.findSessionByDeviceId.mockResolvedValue({
      sessionId: SID,
      revokedAt: null,
    });

    await service.refresh(
      { refreshToken: 'token' },
      { id: 'device-12345678', name: null },
    );

    expect(loginDevices.findSessionByDeviceId).toHaveBeenCalledWith(
      'user-uuid',
      'device-12345678',
    );
    expect(loginDevices.touchActiveSession).toHaveBeenCalledWith(
      'user-uuid',
      SID,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const firstCallPayload = jwtService.sign.mock.calls[0][0];
    expect(firstCallPayload).toMatchObject({ sid: SID });
  });

  it('rejects a legacy token whose known device row was revoked', async () => {
    const { service, jwtService, loginDevices } = makeRefreshService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      role: 'user',
    });
    loginDevices.findSessionByDeviceId.mockResolvedValue({
      sessionId: SID,
      revokedAt: new Date(),
    });

    await expect(
      service.refresh(
        { refreshToken: 'token' },
        { id: 'device-12345678', name: null },
      ),
    ).rejects.toThrow('Session revoked');
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('grandfathers a legacy token with an unknown device', async () => {
    const { service, jwtService, loginDevices } = makeRefreshService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-uuid',
      role: 'user',
    });
    loginDevices.findSessionByDeviceId.mockResolvedValue(null);

    await service.refresh(
      { refreshToken: 'token' },
      { id: 'device-12345678', name: null },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const firstCallPayload = jwtService.sign.mock.calls[0][0];
    expect(firstCallPayload).toEqual({ sub: 'user-uuid', role: 'user' });
  });
});

describe('AuthService verifyPhoneOtp + requestLoginOtp', () => {
  const PHONE = '+85512345678';

  function makeSupabase() {
    return {
      verifyOtp: jest.fn().mockResolvedValue({
        data: { user: { id: 'dev', phone: PHONE } },
        error: null,
      }),
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
    };
  }

  function makeAuthService(
    db: ReturnType<typeof makeDb>,
    supabase: ReturnType<typeof makeSupabase>,
    loginDevices = makeLoginDevices(),
  ) {
    return new AuthService(
      db as never,
      makeJwtService() as never,
      makeConfigService() as never,
      supabase as never,
      loginDevices as never,
      makeOtpService() as never,
      makeOtpSender() as never,
      { notify: jest.fn() } as never,
    );
  }

  type InsertCapture = {
    values: Record<string, unknown>;
    set?: Record<string, unknown>;
  };

  function mockInsert(db: ReturnType<typeof makeDb>, row: UserRow) {
    let captured: InsertCapture | null = null;
    db.insert.mockImplementation(() => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoUpdate: (conf: { set: Record<string, unknown> }) => ({
          returning: () => {
            captured = { values: v, set: conf.set };
            return Promise.resolve([row]);
          },
        }),
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }));
    return () => captured;
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyPhoneOtp — registration (new phone)', () => {
    it('insert carries passwordHash, names, and generated username', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      let selectCall = 0;
      const db = makeDb();
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → none; 2: existing-user check → none;
        // 3: recovery-window lookup (an account this phone could revive) →
        // none; 4: username probe → free; 5: the mirror's own ban re-check
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([]) }),
          }),
        };
      });
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);
      const getCapture = mockInsert(db, makeUser({ username: 'sokdara' }));

      const result = await service.verifyPhoneOtp({
        phone: PHONE,
        token: '000000',
        password: 'password123',
        firstName: 'Sok',
        lastName: 'Dara',
      });

      expect(result.accessToken).toBe('signed-token');
      const captured = getCapture();
      expect(captured).not.toBeNull();
      expect(captured?.values).toMatchObject({
        primaryPhone: PHONE,
        passwordHash: 'hashed-password',
        firstName: 'Sok',
        lastName: 'Dara',
        username: 'sokdara',
      });
      expect(selectCall).toBe(5);
    });

    it('omits username when names are absent', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      const db = makeDb();
      db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }));
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);
      const getCapture = mockInsert(db, makeUser());

      await service.verifyPhoneOtp({
        phone: PHONE,
        token: '000000',
        password: 'password123',
      });

      const captured = getCapture();
      expect(captured?.values).not.toHaveProperty('username');
      expect(captured?.values).not.toHaveProperty('firstName');
    });
  });

  describe('verifyPhoneOtp — login (existing phone)', () => {
    it('conflict update carries ONLY updatedAt — password/names/username can never be overwritten', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const existing = makeUser({
        primaryPhone: PHONE,
        passwordHash: '$2b$10$hash',
      });
      let selectCall = 0;
      const db = makeDb();
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → not banned; 2: existing-user fetch;
        // 3: the mirror's own ban re-check → not banned
        const rows = selectCall === 2 ? [existing] : [];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);
      const getCapture = mockInsert(db, existing);

      await service.verifyPhoneOtp({
        phone: PHONE,
        token: '000000',
        password: 'password123',
        // crafted replay payload — must be ignored on the conflict path
        firstName: 'Hacker',
        lastName: 'Hacker',
      });

      const captured = getCapture();
      expect(captured?.values).toEqual({ primaryPhone: PHONE });
      expect(captured?.set).toEqual({
        updatedAt: expect.any(Date) as unknown as Date,
      });
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(selectCall).toBe(3); // no username probes
    });

    it('stamps phoneVerifiedAt on a successful login OTP (CLAUDE.md known gap, fixed here)', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const existing = makeUser({
        primaryPhone: PHONE,
        passwordHash: '$2b$10$hash',
        phoneVerifiedAt: null,
      });
      let selectCall = 0;
      const db = makeDb();
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → not banned; 2: existing-user fetch;
        // 3: the mirror's own ban re-check → not banned
        const rows = selectCall === 2 ? [existing] : [];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);
      mockInsert(db, existing);
      const updateSets: Record<string, unknown>[] = [];
      db.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
          updateSets.push(values);
          return { where: () => Promise.resolve([]) };
        },
      }));

      await service.verifyPhoneOtp({
        phone: PHONE,
        token: '000000',
        password: 'password123',
      });

      expect(updateSets).toContainEqual({
        phoneVerifiedAt: expect.any(Date) as unknown as Date,
      });
    });

    it('propagates newDevice from the device recorder', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const existing = makeUser({
        primaryPhone: PHONE,
        passwordHash: '$2b$10$hash',
      });
      let selectCall = 0;
      const db = makeDb();
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → not banned; 2: existing-user fetch;
        // 3: the mirror's own ban re-check → not banned
        const rows = selectCall === 2 ? [existing] : [];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });
      const supabase = makeSupabase();
      const loginDevices = makeLoginDevices();
      loginDevices.recordLogin.mockResolvedValue({
        isNewDevice: true,
        sessionId: 'session-1',
      });
      const service = makeAuthService(db, supabase, loginDevices);
      mockInsert(db, existing);
      const device = { id: 'device-12345678', name: 'Chrome on Linux' };

      const result = await service.verifyPhoneOtp(
        { phone: PHONE, token: '000000', password: 'password123' },
        device,
      );

      expect(result.newDevice).toBe(true);
      expect(loginDevices.recordLogin).toHaveBeenCalledWith(
        existing.id,
        device,
      );
    });

    it('wrong password → 401 and Supabase OTP is never consumed', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const db = makeDb();
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → not banned; 2: existing-user fetch
        const rows =
          selectCall === 1
            ? []
            : [makeUser({ primaryPhone: PHONE, passwordHash: '$2b$10$hash' })];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);

      await expect(
        service.verifyPhoneOtp({
          phone: PHONE,
          token: '000000',
          password: 'wrong-pass',
        }),
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(supabase.verifyOtp).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('legacy bare user is completed in place — password set, username generated, insert never called', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      let selectCall = 0;
      const db = makeDb();
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → not banned; 2: existing-user fetch (bare
        // legacy account); 3: username probe → free
        if (selectCall === 2) {
          return {
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    makeUser({
                      primaryPhone: PHONE,
                      passwordHash: null,
                      username: null,
                    }),
                  ]),
              }),
            }),
          };
        }
        // username probe → free
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([]) }),
          }),
        };
      });
      let capturedSet: Record<string, unknown> = {};
      db.update.mockImplementation(() => ({
        set: (data: Record<string, unknown>) => {
          capturedSet = data;
          return {
            where: () => ({
              returning: () =>
                Promise.resolve([
                  makeUser({
                    primaryPhone: PHONE,
                    username: 'legacyuser',
                    passwordHash: 'hashed-password',
                  }),
                ]),
            }),
          };
        },
      }));
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);

      const result = await service.verifyPhoneOtp({
        phone: PHONE,
        token: '000000',
        password: 'password123',
        firstName: 'Legacy',
        lastName: 'User',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(capturedSet).toMatchObject({
        passwordHash: 'hashed-password',
        firstName: 'Legacy',
        lastName: 'User',
        username: 'legacyuser',
      });
      expect(db.insert).not.toHaveBeenCalled();
      expect(supabase.verifyOtp).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestLoginOtp', () => {
    it('sends OTP after password validates', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const db = makeDb();
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: the account lookup; 2: the post-credential ban check → not
        // banned (this path checks the ban *after* the password on purpose)
        const rows =
          selectCall === 1
            ? [makeUser({ primaryPhone: PHONE, passwordHash: '$2b$10$hash' })]
            : [];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);

      await expect(
        service.requestLoginOtp({ phone: PHONE, password: 'password123' }),
      ).resolves.toEqual({ otpSent: true });
      expect(supabase.signInWithOtp).toHaveBeenCalledWith(PHONE);
    });

    it('unknown phone → 401, no OTP sent', async () => {
      const db = makeDb();
      db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }));
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);

      await expect(
        service.requestLoginOtp({ phone: PHONE, password: 'password123' }),
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(supabase.signInWithOtp).not.toHaveBeenCalled();
    });

    it('wrong password → 401, no OTP sent', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const db = makeDb();
      db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                makeUser({ primaryPhone: PHONE, passwordHash: '$2b$10$hash' }),
              ]),
          }),
        }),
      }));
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);

      await expect(
        service.requestLoginOtp({ phone: PHONE, password: 'wrong-pass' }),
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(supabase.signInWithOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifyPhoneOtp — an account inside its recovery window', () => {
    it('revives it instead of creating a second account for the number', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const recoverable = makeUser({
        primaryPhone: PHONE,
        deletedAt: new Date(),
        status: 'deleted',
      });
      let selectCall = 0;
      const db = makeDb();
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → not banned; 2: the active-account lookup
        // → none; 3: the recovery lookup → the deleted account (the WHERE
        // that makes it *recoverable* — window and surviving phone — is SQL
        // and is exercised against the database).
        const rows = selectCall <= 2 ? [] : [recoverable];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });
      const sets: Record<string, unknown>[] = [];
      db.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          return {
            where: () => ({
              returning: () => Promise.resolve([{ ...recoverable, ...values }]),
            }),
          };
        },
      }));
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);

      const result = await service.verifyPhoneOtp({
        phone: PHONE,
        token: '000000',
        password: 'password123',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(sets).toContainEqual({
        status: 'active',
        deletedAt: null,
      });
      // The whole point: no `users` insert, so the phone never forks into a
      // fresh account while the old row is still waiting to be purged.
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('still checks the password before burning an OTP attempt', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const db = makeDb();
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve(
                  selectCall <= 2
                    ? []
                    : [
                        makeUser({
                          primaryPhone: PHONE,
                          deletedAt: new Date(),
                        }),
                      ],
                ),
            }),
          }),
        };
      });
      const supabase = makeSupabase();
      const service = makeAuthService(db, supabase);

      await expect(
        service.verifyPhoneOtp({
          phone: PHONE,
          token: '000000',
          password: 'wrong-pass',
        }),
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(supabase.verifyOtp).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService reactivation on password login', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockReactivation(db: ReturnType<typeof makeDb>, recovered: UserRow) {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      // 1: no active account matches; 2: the recovery lookup finds the
      // deleted one. The window and the surviving-phone test live in that
      // query's WHERE, which the mock bypasses.
      const rows = selectCall === 1 ? [] : [recovered];
      return {
        from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
      };
    });

    const sets: Record<string, unknown>[] = [];
    db.update.mockImplementation(() => ({
      set: (values: Record<string, unknown>) => {
        sets.push(values);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...recovered, ...values }]),
          }),
        };
      },
    }));
    return sets;
  }

  it('clears the deletion and signs the owner back in', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const deleted = makeUser({
      primaryPhone: '+85512345678',
      deletedAt: new Date(),
      status: 'deleted',
    });
    const db = makeDb();
    const sets = mockReactivation(db, deleted);
    const service = makeService(db, makeJwtService(), makeConfigService());

    const result = await service.loginWithPassword({
      identifier: 'testuser',
      password: 'password123',
    });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user.status).toBe('active');
    expect(sets).toContainEqual({ status: 'active', deletedAt: null });
  });

  it('does not sign in someone whose password no longer matches', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const db = makeDb();
    mockReactivation(
      db,
      makeUser({ deletedAt: new Date(), status: 'deleted' }),
    );
    const service = makeService(db, makeJwtService(), makeConfigService());

    await expect(
      service.loginWithPassword({
        identifier: 'testuser',
        password: 'wrong-pass',
      }),
    ).rejects.toThrow(UnauthorizedException);
    // Still deleted — a failed attempt must not quietly undo the deletion.
    expect(db.update).not.toHaveBeenCalled();
  });

  it('rejects identifiers that match nothing at all', async () => {
    const db = makeDb();
    db.select.mockImplementation(() => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }));
    const service = makeService(db, makeJwtService(), makeConfigService());

    await expect(
      service.loginWithPassword({ identifier: 'nobody', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe('VerifyOtpDto validation', () => {
  it('rejects a missing password', async () => {
    const errors = await validate(
      plainToInstance(VerifyOtpDto, { phone: '+85512345678', token: '000000' }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a short password', async () => {
    const errors = await validate(
      plainToInstance(VerifyOtpDto, {
        phone: '+85512345678',
        token: '000000',
        password: 'short',
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('AuthService.findById', () => {
  it('reports verifiedAccount from the active subscription probe', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      const rows = call === 1 ? [makeUser()] : [{ id: 'sub-1' }];
      return {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve(rows) }),
        }),
      };
    });
    const service = makeService(db, makeJwtService(), makeConfigService());

    const me = await service.findById('user-uuid');

    expect(me.verifiedAccount).toBe(true);
  });
});

describe('AuthService social login', () => {
  function makeSocialDb(
    opts: {
      providerUser?: UserRow | null;
      emailUser?: UserRow | null;
      createdUser?: UserRow;
    } = {},
  ) {
    type InsertChain = {
      values: jest.Mock;
      onConflictDoUpdate: jest.Mock;
      onConflictDoNothing: jest.Mock;
      returning: jest.Mock;
    };
    type SelectChain = {
      from: jest.Mock;
      innerJoin: jest.Mock;
      where: jest.Mock;
      limit: jest.Mock;
    };

    const insert = jest.fn((): InsertChain => {
      const chain: InsertChain = {
        values: jest.fn(() => chain),
        onConflictDoUpdate: jest.fn(() => chain),
        onConflictDoNothing: jest.fn(() => chain),
        returning: jest
          .fn()
          .mockResolvedValue([
            opts.createdUser ?? makeUser({ email: 'new@example.com' }),
          ]),
      };
      return chain;
    });

    const select = jest.fn((): SelectChain => {
      let providerQuery = false;
      const chain: SelectChain = {
        from: jest.fn(() => chain),
        innerJoin: jest.fn(() => {
          providerQuery = true;
          return chain;
        }),
        where: jest.fn(() => chain),
        limit: jest.fn(() =>
          Promise.resolve(
            providerQuery
              ? opts.providerUser
                ? [{ user: opts.providerUser }]
                : []
              : opts.emailUser
                ? [opts.emailUser]
                : [],
          ),
        ),
      };
      return chain;
    });

    return { select, insert, update: jest.fn(), delete: jest.fn() };
  }

  function makeSocialUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'supabase-user-id',
      email: 'staff@example.com',
      email_confirmed_at: '2026-01-01T00:00:00Z',
      identities: [{ provider: 'google' }],
      app_metadata: { provider: 'google' },
      ...overrides,
    };
  }

  function makeSocialSupabase(user: Record<string, unknown>) {
    return makeSupabase({
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
      signInWithOAuth: jest.fn().mockResolvedValue({
        data: {
          url: 'https://supabase.example/auth/v1/authorize?provider=google',
        },
        error: null,
      }),
    });
  }

  const googleDto = {
    provider: 'google' as const,
    accessToken: 'supabase-access-token',
  };

  it('forwards the redirectTo to Supabase when the origin is allowed', async () => {
    const supabase = makeSocialSupabase(makeSocialUser());
    const config = makeConfigService({
      frontendOrigins: ['http://localhost:3001'],
    });
    const service = makeService(
      makeDb(),
      makeJwtService(),
      config,
      undefined,
      supabase,
    );

    await service.getSocialAuthUrl(
      'google',
      'http://localhost:3001/en/auth/callback/google',
    );

    expect(supabase.signInWithOAuth).toHaveBeenCalledWith(
      'google',
      'http://localhost:3001/en/auth/callback/google',
    );
  });

  it('rejects a redirect origin that is not allow-listed', async () => {
    const supabase = makeSocialSupabase(makeSocialUser());
    const config = makeConfigService({
      frontendOrigins: ['http://localhost:3001'],
    });
    const service = makeService(
      makeDb(),
      makeJwtService(),
      config,
      undefined,
      supabase,
    );

    await expect(
      service.getSocialAuthUrl(
        'google',
        'https://evil.example/en/auth/callback/google',
      ),
    ).rejects.toThrow('INVALID_REDIRECT_URI');
    expect(supabase.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('rejects a redirect protocol that is not http(s)', async () => {
    const service = makeService(
      makeDb(),
      makeJwtService(),
      makeConfigService(),
      undefined,
      makeSocialSupabase(makeSocialUser()),
    );

    await expect(
      service.getSocialAuthUrl('google', 'javascript:alert(1)'),
    ).rejects.toThrow('INVALID_REDIRECT_URI');
  });

  it('rejects an unsupported provider', async () => {
    const service = makeService(
      makeDb(),
      makeJwtService(),
      makeConfigService(),
      undefined,
      makeSupabase(),
    );

    await expect(service.getSocialAuthUrl('github')).rejects.toThrow(
      'UNSUPPORTED_PROVIDER',
    );
  });

  it('rejects a token whose identity does not match the claimed provider', async () => {
    const supabase = makeSocialSupabase(
      makeSocialUser({ identities: [{ provider: 'facebook' }] }),
    );
    const service = makeService(
      makeDb(),
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    await expect(service.handleSocialCallback(googleDto)).rejects.toThrow(
      'SOCIAL_PROVIDER_MISMATCH',
    );
  });

  it('rejects an unconfirmed social email', async () => {
    const supabase = makeSocialSupabase(
      makeSocialUser({ email_confirmed_at: undefined }),
    );
    const db = makeSocialDb();
    const service = makeService(
      db,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    await expect(service.handleSocialCallback(googleDto)).rejects.toThrow(
      'SOCIAL_EMAIL_UNVERIFIED',
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('admin mode never creates an account and answers uniformly', async () => {
    const supabase = makeSocialSupabase(makeSocialUser());
    const db = makeSocialDb({ providerUser: null, emailUser: null });
    const service = makeService(
      db,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    await expect(
      service.handleSocialCallback({ ...googleDto, mode: 'admin' }),
    ).rejects.toThrow('SOCIAL_LOGIN_NOT_ALLOWED');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('admin mode rejects a non-staff account', async () => {
    const supabase = makeSocialSupabase(makeSocialUser());
    const db = makeSocialDb({
      providerUser: null,
      emailUser: makeUser({ email: 'staff@example.com', role: 'user' }),
    });
    const service = makeService(
      db,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    await expect(
      service.handleSocialCallback({ ...googleDto, mode: 'admin' }),
    ).rejects.toThrow('SOCIAL_LOGIN_NOT_ALLOWED');
  });

  it('admin mode signs in an existing staff account', async () => {
    const supabase = makeSocialSupabase(makeSocialUser());
    const staff = makeUser({ email: 'staff@example.com', role: 'admin' });
    const db = makeSocialDb({ providerUser: null, emailUser: staff });
    const config = makeConfigService({
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshExpiresIn': '30d',
      'jwt.refreshSecret': 'refresh-secret',
    });
    const service = makeService(
      db,
      makeJwtService(),
      config,
      undefined,
      supabase,
    );

    const result = await service.handleSocialCallback({
      ...googleDto,
      mode: 'admin',
    });

    expect(result.user.id).toBe('user-uuid');
    expect(result.accessToken).toBe('signed-token');
  });

  it('user mode links an existing account by lower-cased email', async () => {
    const supabase = makeSocialSupabase(
      makeSocialUser({ email: 'Staff@Example.com' }),
    );
    const existing = makeUser({ email: 'staff@example.com' });
    const db = makeSocialDb({ providerUser: null, emailUser: existing });
    const service = makeService(
      db,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    const result = await service.handleSocialCallback(googleDto);

    expect(result.user.id).toBe(existing.id);
    // The email match wins; only the provider link is inserted.
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('user mode reuses the provider link before the email', async () => {
    const supabase = makeSocialSupabase(makeSocialUser());
    const linked = makeUser({ email: 'old@example.com' });
    const db = makeSocialDb({
      providerUser: linked,
      emailUser: makeUser({ email: 'staff@example.com' }),
    });
    const service = makeService(
      db,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    const result = await service.handleSocialCallback(googleDto);

    expect(result.user.id).toBe(linked.id);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('user mode creates an account when no link or email matched', async () => {
    const supabase = makeSocialSupabase(makeSocialUser());
    const created = makeUser({ email: 'staff@example.com' });
    const db = makeSocialDb({
      providerUser: null,
      emailUser: null,
      createdUser: created,
    });
    const service = makeService(
      db,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    const result = await service.handleSocialCallback(googleDto);

    expect(result.user.id).toBe(created.id);
    // One insert for the user, one for the provider link.
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});

describe('AuthService linked providers', () => {
  const socialUser = {
    id: 'supabase-user-id',
    email: 'user@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    identities: [{ provider: 'google' }],
    app_metadata: { provider: 'google' },
  };

  function supabaseFor(user: Record<string, unknown> | null) {
    return makeSupabase({
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      signInWithOAuth: jest.fn(),
    });
  }

  function makeLinkDb(
    opts: {
      linkedTo?: UserRow | null;
      existing?: { id: string; providerAccountId: string | null } | null;
    } = {},
  ) {
    let selectCall = 0;
    const select = jest.fn(() => {
      selectCall += 1;
      const call = selectCall;
      const chain: Record<string, jest.Mock> = {};
      chain.from = jest.fn(() => chain);
      chain.innerJoin = jest.fn(() => chain);
      chain.where = jest.fn(() => chain);
      chain.limit = jest.fn(() =>
        Promise.resolve(
          call === 1
            ? opts.linkedTo
              ? [{ user: opts.linkedTo }]
              : []
            : opts.existing
              ? [opts.existing]
              : [],
        ),
      );
      return chain;
    });

    const insert = jest.fn(() => ({
      values: jest.fn().mockResolvedValue(undefined),
    }));
    const update = jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(undefined),
      })),
    }));

    return {
      select,
      insert,
      update,
      delete: jest.fn(),
      transaction: jest.fn(),
    };
  }

  function makeUnlinkDb(
    opts: {
      user?: UserRow | null;
      providers?: { provider: string; providerAccountId: string | null }[];
    } = {},
  ) {
    let selectCall = 0;
    const tx = {
      select: jest.fn(() => {
        selectCall += 1;
        const call = selectCall;
        const chain: Record<string, jest.Mock> = {};
        chain.from = jest.fn(() => chain);
        chain.where = jest.fn(() => {
          const thenable = Promise.resolve(
            call === 1
              ? opts.user
                ? [opts.user]
                : []
              : (opts.providers ?? []),
          ) as unknown as Promise<unknown[]> & { for: jest.Mock };
          thenable.for = jest.fn(() =>
            Promise.resolve(opts.user ? [opts.user] : []),
          );
          return thenable;
        });
        return chain;
      }),
      delete: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(undefined),
      })),
    };

    const db = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    return { db, tx };
  }

  const linkDto = { provider: 'google' as const, accessToken: 'x'.repeat(30) };

  it('links a new provider identity to the current user', async () => {
    const db = makeLinkDb();
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabaseFor(socialUser),
    );

    const result = await service.linkSocialProvider('user-uuid', linkDto);

    expect(result).toEqual({
      provider: 'google',
      providerAccountId: 'supabase-user-id',
      linked: true,
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('refuses an identity already linked to another user', async () => {
    const db = makeLinkDb({ linkedTo: makeUser({ id: 'other-user' }) });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabaseFor(socialUser),
    );

    await expect(
      service.linkSocialProvider('user-uuid', linkDto),
    ).rejects.toThrow('already connected to another user');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('refuses a different account for the same provider', async () => {
    const db = makeLinkDb({
      existing: { id: 'row-1', providerAccountId: 'another-account' },
    });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabaseFor(socialUser),
    );

    await expect(
      service.linkSocialProvider('user-uuid', linkDto),
    ).rejects.toThrow('A different account for this provider');
  });

  it('is idempotent when the identity already belongs to the user', async () => {
    const db = makeLinkDb({
      linkedTo: makeUser({ id: 'user-uuid' }),
      existing: { id: 'row-1', providerAccountId: 'supabase-user-id' },
    });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabaseFor(socialUser),
    );

    const result = await service.linkSocialProvider('user-uuid', linkDto);

    expect(result.linked).toBe(true);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('fills the account id on a legacy row with none', async () => {
    const db = makeLinkDb({
      existing: { id: 'row-1', providerAccountId: null },
    });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabaseFor(socialUser),
    );

    await service.linkSocialProvider('user-uuid', linkDto);

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects an invalid provider token', async () => {
    const supabase = makeSupabase({
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: {} }),
      signInWithOAuth: jest.fn(),
    });
    const service = makeService(
      makeLinkDb() as never,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    await expect(
      service.linkSocialProvider('user-uuid', linkDto),
    ).rejects.toThrow('Invalid social access token');
  });

  it('rejects a token belonging to another provider', async () => {
    const supabase = supabaseFor({
      ...socialUser,
      identities: [{ provider: 'facebook' }],
      app_metadata: { provider: 'facebook' },
    });
    const service = makeService(
      makeLinkDb() as never,
      makeJwtService(),
      makeConfigService(),
      undefined,
      supabase,
    );

    await expect(
      service.linkSocialProvider('user-uuid', linkDto),
    ).rejects.toThrow('SOCIAL_PROVIDER_MISMATCH');
  });

  it('unlinks a provider when the account has another way in', async () => {
    const { db } = makeUnlinkDb({
      user: makeUser(),
      providers: [{ provider: 'google', providerAccountId: 'a' }],
    });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
    );

    const result = await service.unlinkSocialProvider('user-uuid', 'google');

    expect(result).toEqual({ provider: 'google', unlinked: true });
  });

  it('refuses to remove the account last way in', async () => {
    const { db } = makeUnlinkDb({
      user: makeUser({
        username: null,
        passwordHash: null,
        primaryPhone: null,
      }),
      providers: [{ provider: 'google', providerAccountId: 'a' }],
    });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
    );

    await expect(
      service.unlinkSocialProvider('user-uuid', 'google'),
    ).rejects.toThrow('only way to sign in');
  });

  it('counts a phone as a fallback login method', async () => {
    const { db } = makeUnlinkDb({
      user: makeUser({
        username: null,
        passwordHash: null,
        primaryPhone: '+85512345678',
      }),
      providers: [{ provider: 'google', providerAccountId: 'a' }],
    });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
    );

    const result = await service.unlinkSocialProvider('user-uuid', 'google');

    expect(result.unlinked).toBe(true);
  });

  it('counts another linked provider as a fallback', async () => {
    const { db } = makeUnlinkDb({
      user: makeUser({
        username: null,
        passwordHash: null,
        primaryPhone: null,
      }),
      providers: [
        { provider: 'google', providerAccountId: 'a' },
        { provider: 'telegram', providerAccountId: 'b' },
      ],
    });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
    );

    const result = await service.unlinkSocialProvider('user-uuid', 'google');

    expect(result.unlinked).toBe(true);
  });

  it('is a no-op for a provider that is not linked', async () => {
    const { db } = makeUnlinkDb({
      user: makeUser(),
      providers: [{ provider: 'telegram', providerAccountId: 'b' }],
    });
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
    );

    const result = await service.unlinkSocialProvider('user-uuid', 'google');

    expect(result).toEqual({ provider: 'google', unlinked: false });
  });

  it('rejects a provider outside the allow-list', async () => {
    const { db } = makeUnlinkDb();
    const service = makeService(
      db as never,
      makeJwtService(),
      makeConfigService(),
    );

    await expect(
      service.unlinkSocialProvider('user-uuid', 'github'),
    ).rejects.toThrow('Unsupported provider');
  });
});

describe('AuthService phone OTP (provider switch)', () => {
  const PHONE = '+85512345678';

  function selects(
    db: ReturnType<typeof makeDb>,
    rowsFor: (n: number) => UserRow[],
  ) {
    let n = 0;
    db.select.mockImplementation(() => {
      n++;
      const rows = rowsFor(n);
      return {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve(rows) }),
        }),
      };
    });
  }

  function build(provider: 'plasgate' | 'supabase') {
    const db = makeDb();
    const otpService = makeOtpService();
    const otpSender = makeOtpSender();
    const supabase = {
      verifyOtp: jest.fn().mockResolvedValue({
        data: { user: { id: 'sb', phone: PHONE } },
        error: null,
      }),
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
    };
    const service = new AuthService(
      db as never,
      { sign: jest.fn().mockReturnValue('signed-token') } as never,
      makeConfigService({ 'otp.provider': provider }) as never,
      supabase as never,
      makeLoginDevices() as never,
      otpService as never,
      otpSender as never,
      { notify: jest.fn() } as never,
    );
    return { db, service, otpService, otpSender, supabase };
  }

  function mockInsert(db: ReturnType<typeof makeDb>, row: UserRow) {
    db.insert.mockImplementation(() => ({
      values: () => ({
        onConflictDoUpdate: () => ({ returning: () => Promise.resolve([row]) }),
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }));
  }

  function captureUpdates(db: ReturnType<typeof makeDb>) {
    const sets: Record<string, unknown>[] = [];
    db.update.mockImplementation(() => ({
      set: (v: Record<string, unknown>) => {
        sets.push(v);
        return {
          where: () => {
            const p = Promise.resolve([]) as Promise<unknown[]> & {
              returning?: () => Promise<UserRow[]>;
            };
            p.returning = () =>
              Promise.resolve([makeUser({ primaryPhone: PHONE })]);
            return p;
          },
        };
      },
    }));
    return sets;
  }

  function bannedDb(db: ReturnType<typeof makeDb>) {
    db.select.mockImplementation(() => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ id: 'ban' }]) }),
      }),
    }));
  }

  afterEach(() => jest.clearAllMocks());

  describe('plasgate: sending', () => {
    it('register issues+sends and returns retryAfterSeconds (with client ip)', async () => {
      const { db, service, otpSender, supabase } = build('plasgate');
      selects(db, () => []);
      otpSender.issueAndSend.mockResolvedValue({
        status: 'sent',
        retryAfterSeconds: 300,
      });

      await expect(
        service.registerWithPhone(
          { phone: PHONE, password: 'x' } as never,
          '1.2.3.4',
        ),
      ).resolves.toEqual({ otpSent: true, retryAfterSeconds: 300 });
      expect(otpSender.issueAndSend).toHaveBeenCalledWith(
        PHONE,
        'register',
        '1.2.3.4',
      );
      expect(supabase.signInWithOtp).not.toHaveBeenCalled();
    });

    it('cooldown -> 429 OTP_COOLDOWN with retryAfterSeconds', async () => {
      const { db, service, otpSender } = build('plasgate');
      selects(db, () => []);
      otpSender.issueAndSend.mockResolvedValue({
        status: 'cooldown',
        retryAfterSeconds: 42,
      });

      const err = await service
        .registerWithPhone({ phone: PHONE, password: 'x' } as never)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      const http = err as HttpException;
      expect(http.getStatus()).toBe(429);
      expect(http.getResponse()).toMatchObject({
        code: 'OTP_COOLDOWN',
        retryAfterSeconds: 42,
      });
      expect(otpSender.issueAndSend).toHaveBeenCalledTimes(1);
    });

    it('daily cap -> 429 OTP_DAILY_CAP', async () => {
      const { db, service, otpSender } = build('plasgate');
      selects(db, () => []);
      otpSender.issueAndSend.mockResolvedValue({ status: 'daily_cap' });
      const err = (await service
        .requestPhoneOtp(PHONE)
        .catch((e: unknown) => e)) as HttpException;
      expect(err.getStatus()).toBe(429);
      expect(err.getResponse()).toMatchObject({ code: 'OTP_DAILY_CAP' });
    });

    it.each(['provider_rejected', 'unavailable'])(
      '%s -> 503 OTP_SEND_FAILED without provider text',
      async (status) => {
        const { db, service, otpSender } = build('plasgate');
        selects(db, () => []);
        otpSender.issueAndSend.mockResolvedValue({ status });
        const err = await service
          .registerWithPhone({ phone: PHONE, password: 'x' } as never)
          .catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        expect((err as HttpException).getResponse()).toMatchObject({
          code: 'OTP_SEND_FAILED',
        });
      },
    );

    it('banned number gets no SMS and no code', async () => {
      const { db, service, otpSender } = build('plasgate');
      bannedDb(db);
      await expect(
        service.registerWithPhone({ phone: PHONE, password: 'x' } as never),
      ).rejects.toBeDefined();
      expect(otpSender.issueAndSend).not.toHaveBeenCalled();
    });

    it('resend infers login for an active account and register otherwise', async () => {
      const a = build('plasgate');
      // 1: ban lookup (none), 2: active user lookup (found)
      selects(a.db, (n) =>
        n === 2 ? [makeUser({ primaryPhone: PHONE })] : [],
      );
      a.otpSender.issueAndSend.mockResolvedValue({
        status: 'sent',
        retryAfterSeconds: 300,
      });
      await a.service.requestPhoneOtp(PHONE, 'ip');
      expect(a.otpSender.issueAndSend).toHaveBeenCalledWith(
        PHONE,
        'login',
        'ip',
      );

      const b = build('plasgate');
      selects(b.db, () => []);
      b.otpSender.issueAndSend.mockResolvedValue({
        status: 'sent',
        retryAfterSeconds: 300,
      });
      await b.service.requestPhoneOtp(PHONE, 'ip');
      expect(b.otpSender.issueAndSend).toHaveBeenCalledWith(
        PHONE,
        'register',
        'ip',
      );
    });

    it('login OTP: wrong password sends nothing; right password sends a login code', async () => {
      const user = makeUser({ primaryPhone: PHONE, passwordHash: 'h' });
      const bad = build('plasgate');
      selects(bad.db, () => [user]);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      await expect(
        bad.service.requestLoginOtp({ phone: PHONE, password: 'no' } as never),
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(bad.otpSender.issueAndSend).not.toHaveBeenCalled();

      const good = build('plasgate');
      selects(good.db, (n) => (n === 1 ? [user] : []));
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      good.otpSender.issueAndSend.mockResolvedValue({
        status: 'sent',
        retryAfterSeconds: 300,
      });
      await expect(
        good.service.requestLoginOtp(
          { phone: PHONE, password: 'ok' } as never,
          'ip',
        ),
      ).resolves.toEqual({ otpSent: true, retryAfterSeconds: 300 });
      expect(good.otpSender.issueAndSend).toHaveBeenCalledWith(
        PHONE,
        'login',
        'ip',
      );
    });
  });

  describe('plasgate: verify', () => {
    it('right code creates the account and stamps phoneVerifiedAt', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const { db, service, otpService, supabase } = build('plasgate');
      selects(db, () => []);
      mockInsert(db, makeUser({ primaryPhone: PHONE }));
      const sets = captureUpdates(db);
      otpService.verify.mockResolvedValue({
        status: 'ok',
        purpose: 'register',
      });

      const res = await service.verifyPhoneOtp({
        phone: PHONE,
        token: '123456',
        password: 'password123',
      });

      expect(res.accessToken).toBe('signed-token');
      expect(otpService.verify).toHaveBeenCalledWith(
        PHONE,
        ['register', 'login'],
        '123456',
      );
      expect(supabase.verifyOtp).not.toHaveBeenCalled();
      expect(sets).toContainEqual({
        phoneVerifiedAt: expect.any(Date) as unknown as Date,
      });
    });

    it.each(['invalid', 'expired', 'too_many_attempts'])(
      '%s code -> 401 Invalid or expired OTP, no distinct body (enumeration)',
      async (status) => {
        const { db, service, otpService } = build('plasgate');
        selects(db, () => []);
        otpService.verify.mockResolvedValue({ status });
        await expect(
          service.verifyPhoneOtp({
            phone: PHONE,
            token: '000000',
            password: 'password123',
          }),
        ).rejects.toThrow(new UnauthorizedException('Invalid or expired OTP'));
        expect(db.insert).not.toHaveBeenCalled();
      },
    );

    it('wrong password never calls OtpService.verify (no attempt burnt)', async () => {
      const { db, service, otpService } = build('plasgate');
      selects(db, (n) =>
        n === 2 ? [makeUser({ primaryPhone: PHONE, passwordHash: 'h' })] : [],
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.verifyPhoneOtp({
          phone: PHONE,
          token: '123456',
          password: 'bad',
        }),
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(otpService.verify).not.toHaveBeenCalled();
    });

    it('banned number never reaches OtpService.verify', async () => {
      const { db, service, otpService } = build('plasgate');
      bannedDb(db);
      await expect(
        service.verifyPhoneOtp({
          phone: PHONE,
          token: '123456',
          password: 'password123',
        }),
      ).rejects.toBeDefined();
      expect(otpService.verify).not.toHaveBeenCalled();
    });

    it('revives a deleted account after a valid code', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const recoverable = makeUser({
        primaryPhone: PHONE,
        deletedAt: new Date(),
        status: 'deleted',
      });
      const { db, service, otpService } = build('plasgate');
      selects(db, (n) => (n <= 2 ? [] : [recoverable]));
      const sets = captureUpdates(db);
      otpService.verify.mockResolvedValue({ status: 'ok', purpose: 'login' });
      const res = await service.verifyPhoneOtp({
        phone: PHONE,
        token: '123456',
        password: 'password123',
      });
      expect(res.accessToken).toBe('signed-token');
      expect(sets).toContainEqual({ status: 'active', deletedAt: null });
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('completes a bare account in place after a valid code', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const { db, service, otpService } = build('plasgate');
      selects(db, (n) =>
        n === 2
          ? [
              makeUser({
                primaryPhone: PHONE,
                passwordHash: null,
                username: null,
              }),
            ]
          : [],
      );
      const sets = captureUpdates(db);
      otpService.verify.mockResolvedValue({ status: 'ok', purpose: 'login' });
      await service.verifyPhoneOtp({
        phone: PHONE,
        token: '123456',
        password: 'password123',
      });
      expect(sets[0]).toMatchObject({ passwordHash: 'hashed' });
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('login-OTP end to end: existing user, right password and code', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const existing = makeUser({ primaryPhone: PHONE, passwordHash: 'h' });
      const { db, service, otpService } = build('plasgate');
      selects(db, (n) => (n === 2 ? [existing] : []));
      mockInsert(db, existing);
      captureUpdates(db);
      otpService.verify.mockResolvedValue({ status: 'ok', purpose: 'login' });
      const res = await service.verifyPhoneOtp({
        phone: PHONE,
        token: '123456',
        password: 'password123',
      });
      expect(res.user.id).toBe(existing.id);
    });
  });

  describe('supabase provider', () => {
    it('never touches OtpService / OtpSmsSender', async () => {
      const { db, service, otpService, otpSender, supabase } =
        build('supabase');
      selects(db, () => []);
      mockInsert(db, makeUser({ primaryPhone: PHONE }));
      captureUpdates(db);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await expect(
        service.registerWithPhone({ phone: PHONE, password: 'x' } as never),
      ).resolves.toEqual({ otpSent: true });
      await expect(service.requestPhoneOtp(PHONE)).resolves.toEqual({
        otpSent: true,
      });
      await service.verifyPhoneOtp({
        phone: PHONE,
        token: '123456',
        password: 'password123',
      });

      expect(supabase.signInWithOtp).toHaveBeenCalledTimes(2);
      expect(supabase.verifyOtp).toHaveBeenCalledTimes(1);
      expect(otpSender.issueAndSend).not.toHaveBeenCalled();
      expect(otpService.verify).not.toHaveBeenCalled();
    });
  });
});
