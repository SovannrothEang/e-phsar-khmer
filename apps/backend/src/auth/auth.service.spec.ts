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

function makeService(
  db: ReturnType<typeof makeDb>,
  jwtService: ReturnType<typeof makeJwtService>,
  configService: ReturnType<typeof makeConfigService>,
) {
  return new AuthService(
    db as never,
    jwtService as never,
    configService as never,
    {} as never,
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
  ) {
    return new AuthService(
      db as never,
      makeJwtService() as never,
      makeConfigService() as never,
      supabase as never,
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
        // call 1: existing-user check → none; call 2: username probe → free
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
      expect(selectCall).toBe(2);
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
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([existing]) }),
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
      expect(selectCall).toBe(1); // no username probes
    });

    it('wrong password → 401 and Supabase OTP is never consumed', async () => {
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
        if (selectCall === 1) {
          // existing-user fetch: bare legacy account
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
