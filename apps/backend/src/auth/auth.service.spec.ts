import { UnauthorizedException } from '@nestjs/common';
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
    update: jest.fn(),
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

function makeService(
  db: ReturnType<typeof makeDb>,
  jwtService: ReturnType<typeof makeJwtService>,
  configService: ReturnType<typeof makeConfigService>,
  loginDevices = makeLoginDevices(),
) {
  return new AuthService(
    db as never,
    jwtService as never,
    configService as never,
    {} as never,
    loginDevices as never,
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
