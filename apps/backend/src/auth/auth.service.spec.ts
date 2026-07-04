import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
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
