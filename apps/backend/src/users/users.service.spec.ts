import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PgDialect } from 'drizzle-orm/pg-core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { BillingAddressesService } from './billing-addresses.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { ChangeUsernameDto } from './dto/change-username.dto';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

jest.mock('bcrypt');

type MockDb = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  transaction: jest.Mock;
};

function makeDb(): MockDb {
  const db: MockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  };
  // Runs the callback against the same mock, so a transactional method is
  // exercised exactly like a non-transactional one.
  db.transaction.mockImplementation((cb: (tx: MockDb) => unknown) => cb(db));
  return db;
}

function makeService(
  db: ReturnType<typeof makeDb>,
  supabase: Record<string, jest.Mock> = {},
  notifications: Record<string, jest.Mock> = {
    notify: jest.fn().mockResolvedValue(undefined),
  },
) {
  const filesService = {
    removeByPublicUrl: jest.fn().mockResolvedValue(undefined),
  };
  const service = new UsersService(
    db as never,
    supabase as never,
    {} as never,
    filesService as never,
    notifications as never,
  );
  (service as unknown as { db: unknown }).db = db;
  return service;
}

/**
 * A chainable query stub that is also awaitable, so one shape serves both
 * `…where()` (awaited directly, as the count/hydrate queries are) and
 * `…where().orderBy().limit().offset()` (the paged edge query).
 */
function chain<T>(result: T[]) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.from = self;
  c.where = self;
  c.orderBy = self;
  c.limit = self;
  c.offset = self;
  c.returning = () => Promise.resolve(result);
  c.then = (resolve: (value: T[]) => unknown) =>
    Promise.resolve(result).then(resolve);
  return c;
}

describe('UsersService phone management', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  describe('addPhone', () => {
    it('inserts with isPrimary=true when no existing phones', async () => {
      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: () => ({
              where: () => ({ limit: () => Promise.resolve([]) }),
            }),
          };
        }
        return {
          from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
        };
      });
      db.update.mockReturnValue({
        set: () => ({ where: () => Promise.resolve([]) }),
      });
      const created = {
        id: 'p1',
        userId: 'u1',
        phone: '+855123',
        isPrimary: true,
      };
      db.insert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([created]) }),
      });

      const result = await service.addPhone('u1', { phone: '+855123' });
      expect(result.isPrimary).toBe(true);
    });

    it('throws ConflictException when phone already in use', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → not banned; 2: phone owner check
        const rows = selectCall === 1 ? [] : [{ id: 'existing' }];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });

      await expect(
        service.addPhone('u1', { phone: '+855123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('demotes other phones when isPrimary=true on second phone', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup, 2: existing-phone check — both empty;
        // 3: hasAny (this user already has a phone)
        if (selectCall <= 2) {
          return {
            from: () => ({
              where: () => ({ limit: () => Promise.resolve([]) }),
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 'existing' }]),
            }),
          }),
        };
      });

      const updateWhere = jest.fn().mockResolvedValue([]);
      db.update.mockReturnValue({ set: () => ({ where: updateWhere }) });

      const created = {
        id: 'p2',
        userId: 'u1',
        phone: '+855999',
        isPrimary: true,
      };
      db.insert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([created]) }),
      });

      await service.addPhone('u1', { phone: '+855999', isPrimary: true });
      expect(updateWhere).toHaveBeenCalled();
    });

    it('clears phoneVerifiedAt when the new phone becomes primary (not OTP-verified)', async () => {
      db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }));
      const sets: Record<string, unknown>[] = [];
      db.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          return { where: () => Promise.resolve([]) };
        },
      }));
      db.insert.mockReturnValue({
        values: () => ({
          returning: () =>
            Promise.resolve([
              { id: 'p1', userId: 'u1', phone: '+855123', isPrimary: true },
            ]),
        }),
      });

      await service.addPhone('u1', { phone: '+855123' });

      const usersSet = sets.find((s) => 'primaryPhone' in s);
      expect(usersSet).toMatchObject({ primaryPhone: '+855123' });
      expect(usersSet?.phoneVerifiedAt).toBeNull();
    });
  });

  describe('updatePhone', () => {
    const savedPhone = {
      id: 'p1',
      userId: 'u1',
      phone: '+855111',
      isPrimary: false,
    };

    it('edits the contact number without touching users.primaryPhone', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned lookup; 2: ownership; 3: duplicate check
        const rows = selectCall === 2 ? [savedPhone] : [];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });
      let updateSet: Record<string, unknown> | undefined;
      db.update.mockReturnValue({
        set: (arg: Record<string, unknown>) => {
          updateSet = arg;
          return {
            where: () => ({
              returning: () =>
                Promise.resolve([{ ...savedPhone, phone: '+855222' }]),
            }),
          };
        },
      });

      const result = await service.updatePhone('u1', 'p1', {
        phone: '+855222',
      });

      expect(result.phone).toBe('+855222');
      expect(updateSet).toEqual({ phone: '+855222' });
      // Only the user_phones row is written — the login phone stays put.
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('returns the row unchanged when the number did not move', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        const rows = selectCall === 2 ? [savedPhone] : [];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });

      const result = await service.updatePhone('u1', 'p1', {
        phone: '+855111',
      });

      expect(result).toEqual(savedPhone);
      expect(db.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the row is not the caller’s', async () => {
      // Both the banned lookup and the ownership lookup come back empty.
      db.select.mockImplementation(() => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }));

      await expect(
        service.updatePhone('u1', 'p-other', { phone: '+855222' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when another row owns the number', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        const rows =
          selectCall === 1
            ? []
            : selectCall === 2
              ? [savedPhone]
              : [{ id: 'p-other' }];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });

      await expect(
        service.updatePhone('u1', 'p1', { phone: '+855222' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setPrimaryPhone', () => {
    it('throws NotFoundException when phone not found or wrong owner', async () => {
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      });

      await expect(
        service.setPrimaryPhone('u1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('demotes all phones then promotes target', async () => {
      const target = {
        id: 'p1',
        userId: 'u1',
        phone: '+855123',
        isPrimary: false,
      };
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([target]) }),
        }),
      });

      const promotedRow = { ...target, isPrimary: true };
      let updateCallCount = 0;
      db.update.mockImplementation(() => ({
        set: () => ({
          where: () => {
            updateCallCount++;
            if (updateCallCount === 1) {
              // first call: demote all — no .returning()
              return Promise.resolve([]);
            }
            // second call: promote target — returns object with .returning()
            return { returning: () => Promise.resolve([promotedRow]) };
          },
        }),
      }));

      const result = await service.setPrimaryPhone('u1', 'p1');
      expect(result.isPrimary).toBe(true);
    });

    it('clears phoneVerifiedAt on the users row (the new primary was never OTP-verified)', async () => {
      const target = {
        id: 'p1',
        userId: 'u1',
        phone: '+855123',
        isPrimary: false,
      };
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([target]) }),
        }),
      });

      const sets: Record<string, unknown>[] = [];
      db.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          return {
            where: () => ({ returning: () => Promise.resolve([target]) }),
          };
        },
      }));

      await service.setPrimaryPhone('u1', 'p1');

      const usersSet = sets.find((s) => 'primaryPhone' in s);
      expect(usersSet).toMatchObject({ primaryPhone: '+855123' });
      expect(usersSet?.phoneVerifiedAt).toBeNull();
    });
  });

  describe('removePhone', () => {
    const phone = (id: string, isPrimary: boolean) => ({
      id,
      userId: 'u1',
      phone: `+855${id}`,
      isPrimary,
    });
    const phonesQuery = (rows: object[]) => ({
      from: () => ({ where: () => ({ for: () => Promise.resolve(rows) }) }),
    });

    it('throws NotFoundException for a phone the user does not own', async () => {
      db.select.mockReturnValue(phonesQuery([phone('p2', true)]));

      await expect(service.removePhone('u1', 'p1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to remove the only phone', async () => {
      db.select.mockReturnValue(phonesQuery([phone('p1', true)]));

      await expect(service.removePhone('u1', 'p1')).rejects.toThrow(
        BadRequestException,
      );
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('removes a secondary phone without touching the primary', async () => {
      db.select.mockReturnValue(
        phonesQuery([phone('p1', true), phone('p2', false)]),
      );
      db.delete.mockReturnValue({ where: () => Promise.resolve([]) });

      const result = await service.removePhone('u1', 'p2');
      expect(result).toEqual({ removed: true });
      expect(db.update).not.toHaveBeenCalled();
    });

    it('promotes another phone and moves primaryPhone when the primary goes', async () => {
      db.select.mockReturnValue(
        phonesQuery([phone('p1', true), phone('p2', false)]),
      );
      db.delete.mockReturnValue({ where: () => Promise.resolve([]) });
      const sets: unknown[] = [];
      db.update.mockReturnValue({
        set: (v: unknown) => {
          sets.push(v);
          return { where: () => Promise.resolve([]) };
        },
      });

      await service.removePhone('u1', 'p1');
      expect(sets[0]).toEqual({ isPrimary: true });
      expect(sets[1]).toMatchObject({ primaryPhone: '+855p2' });
      // The promoted phone was never OTP-verified as the login identifier.
      expect((sets[1] as Record<string, unknown>).phoneVerifiedAt).toBeNull();
    });
  });

  it('addPhone maps a concurrent duplicate (23505) to ConflictException', async () => {
    db.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    db.update.mockReturnValue({
      set: () => ({ where: () => Promise.resolve([]) }),
    });
    db.insert.mockReturnValue({
      values: () => ({
        returning: () =>
          Promise.reject(
            Object.assign(new Error('duplicate'), { code: '23505' }),
          ),
      }),
    });

    await expect(service.addPhone('u1', { phone: '+855123' })).rejects.toThrow(
      ConflictException,
    );
  });
});

const fakeUser = {
  id: 'u1',
  username: null,
  passwordHash: null,
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
  provinceId: null as string | null,
  districtId: null as string | null,
  communeId: null as string | null,
  address: null,
  latitude: null,
  longitude: null,
  preferredLanguage: 'en',
  role: 'user' as const,
  status: 'active' as const,
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
};

describe('UsersService updateProfile location validation', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  it('skips DB location check when no location fields in DTO', async () => {
    db.update.mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...fakeUser, company: 'X' }]),
        }),
      }),
    });

    await service.updateProfile('u1', { company: 'X' });

    expect(db.select).not.toHaveBeenCalled();
  });

  it('clears emailVerifiedAt when the address changes', async () => {
    db.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                ...fakeUser,
                email: 'old@example.com',
                emailVerifiedAt: new Date(),
              },
            ]),
        }),
      }),
    });
    let setData: Record<string, unknown> = {};
    db.update.mockReturnValue({
      set: (values: Record<string, unknown>) => {
        setData = values;
        return {
          where: () => ({
            returning: () =>
              Promise.resolve([{ ...fakeUser, email: 'new@example.com' }]),
          }),
        };
      },
    });

    await service.updateProfile('u1', { email: 'new@example.com' });

    expect(setData.email).toBe('new@example.com');
    expect(setData.emailVerifiedAt).toBeNull();
  });

  it('keeps emailVerifiedAt when the address is unchanged (case-insensitive)', async () => {
    db.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                ...fakeUser,
                email: 'old@example.com',
                emailVerifiedAt: new Date(),
              },
            ]),
        }),
      }),
    });
    let setData: Record<string, unknown> = {};
    db.update.mockReturnValue({
      set: (values: Record<string, unknown>) => {
        setData = values;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser }]),
          }),
        };
      },
    });

    await service.updateProfile('u1', { email: 'OLD@example.com' });

    expect(setData).not.toHaveProperty('emailVerifiedAt');
  });

  it('accepts districtId that belongs to provided provinceId', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([{ ...fakeUser }]) }),
          }),
        };
      }
      // district validation → provinceId matches
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ provinceId: 'prov-1' }]),
          }),
        }),
      };
    });
    db.update.mockReturnValue({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([{ ...fakeUser }]) }),
      }),
    });

    await expect(
      service.updateProfile('u1', {
        provinceId: 'prov-1',
        districtId: 'dist-1',
      }),
    ).resolves.toBeDefined();
  });

  it('throws INVALID_LOCATION_HIERARCHY when districtId does not belong to provinceId', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([{ ...fakeUser }]) }),
          }),
        };
      }
      // district belongs to a different province
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ provinceId: 'prov-OTHER' }]),
          }),
        }),
      };
    });

    await expect(
      service.updateProfile('u1', {
        provinceId: 'prov-1',
        districtId: 'dist-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when provinceId changes and existing districtId no longer belongs', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  { ...fakeUser, provinceId: 'prov-old', districtId: 'dist-1' },
                ]),
            }),
          }),
        };
      }
      // district still belongs to prov-old, not prov-new
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ provinceId: 'prov-old' }]),
          }),
        }),
      };
    });

    await expect(
      service.updateProfile('u1', { provinceId: 'prov-new' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts communeId that belongs to the effective districtId', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([{ ...fakeUser, districtId: 'dist-1' }]),
            }),
          }),
        };
      }
      // commune validation → districtId matches
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ districtId: 'dist-1' }]),
          }),
        }),
      };
    });
    db.update.mockReturnValue({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([{ ...fakeUser }]) }),
      }),
    });

    await expect(
      service.updateProfile('u1', { communeId: 'commune-1' }),
    ).resolves.toBeDefined();
  });

  it('throws INVALID_LOCATION_HIERARCHY when communeId does not belong to districtId', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([{ ...fakeUser, districtId: 'dist-1' }]),
            }),
          }),
        };
      }
      // commune belongs to a different district
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ districtId: 'dist-OTHER' }]),
          }),
        }),
      };
    });

    await expect(
      service.updateProfile('u1', { communeId: 'commune-wrong' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('UsersService updateProfile ads contact sync', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  it('writes NULL (not the string "null") when the map pin is cleared', async () => {
    let updateSet: Record<string, unknown> | undefined;
    db.update.mockReturnValue({
      set: (arg: Record<string, unknown>) => {
        updateSet = arg;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser }]),
          }),
        };
      },
    });

    await service.updateProfile('u1', { latitude: null, longitude: null });

    expect(updateSet?.latitude).toBeNull();
    expect(updateSet?.longitude).toBeNull();
  });

  it('copies the contact block and location to the user listings when asked', async () => {
    const user = {
      ...fakeUser,
      username: 'sokdara',
      firstName: 'Sok',
      lastName: 'Dara',
      email: 'dara@example.com',
      primaryPhone: '+855111',
      provinceId: 'p1',
      districtId: 'd1',
      communeId: 'c1',
      address: 'House no. 1',
      latitude: '11.5564000',
      longitude: '104.9282000',
    };
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValue({
      set: (arg: Record<string, unknown>) => {
        sets.push(arg);
        return {
          where: () => ({
            returning: () => Promise.resolve([user]),
          }),
        };
      },
    });
    db.select.mockReturnValue(
      chain([
        { phone: '+855222', isPrimary: false },
        { phone: '+855111', isPrimary: true },
      ]),
    );

    await service.updateProfile('u1', { updateAdsContact: true });

    expect(sets).toHaveLength(2);
    expect(sets[1]).toMatchObject({
      contactName: 'Sok Dara',
      contactPhones: ['+855111', '+855222'],
      contactEmail: 'dara@example.com',
      provinceId: 'p1',
      districtId: 'd1',
      communeId: 'c1',
      address: 'House no. 1',
      latitude: '11.5564000',
      longitude: '104.9282000',
    });
  });

  it('leaves an ad pin alone when the profile has no pin', async () => {
    const user = { ...fakeUser, username: 'sokdara', primaryPhone: '+855111' };
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValue({
      set: (arg: Record<string, unknown>) => {
        sets.push(arg);
        return {
          where: () => ({
            returning: () => Promise.resolve([user]),
          }),
        };
      },
    });
    db.select.mockReturnValue(chain([]));

    await service.updateProfile('u1', { updateAdsContact: true });

    // The cascade and address still mirror the profile (here: cleared), but a
    // pinless account must never wipe the coordinate pair an ad carries.
    expect(sets[1]).toMatchObject({ provinceId: null, address: null });
    expect(sets[1]).not.toHaveProperty('latitude');
    expect(sets[1]).not.toHaveProperty('longitude');
  });

  it('falls back to primaryPhone when the account has no phone rows', async () => {
    const user = {
      ...fakeUser,
      username: 'sokdara',
      primaryPhone: '+855111',
    };
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValue({
      set: (arg: Record<string, unknown>) => {
        sets.push(arg);
        return {
          where: () => ({
            returning: () => Promise.resolve([user]),
          }),
        };
      },
    });
    db.select.mockReturnValue(chain([]));

    await service.updateProfile('u1', { updateAdsContact: true });

    expect(sets[1].contactPhones).toEqual(['+855111']);
    expect(sets[1].contactName).toBe('sokdara');
  });

  it('does not touch listings when the checkbox is off', async () => {
    db.update.mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...fakeUser }]),
        }),
      }),
    });

    await service.updateProfile('u1', { company: 'X' });

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('UsersService updateProfile date of birth', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  function mockUpdate() {
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValue({
      set: (arg: Record<string, unknown>) => {
        sets.push(arg);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser }]),
          }),
        };
      },
    });
    return sets;
  }

  it('stores the day and derives the legacy year', async () => {
    const sets = mockUpdate();

    await service.updateProfile('u1', { dateOfBirth: '1995-04-17' });

    expect(sets[0].dateOfBirth).toBe('1995-04-17');
    expect(sets[0].yearOfBirth).toBe(1995);
  });

  it('clears both representations when null', async () => {
    const sets = mockUpdate();

    await service.updateProfile('u1', {
      dateOfBirth: null,
      // The full date is authoritative, so an explicit stale year loses.
      yearOfBirth: 1990,
    });

    expect(sets[0].dateOfBirth).toBeNull();
    expect(sets[0].yearOfBirth).toBeNull();
  });

  it('rejects a future birthday', async () => {
    mockUpdate();

    await expect(
      service.updateProfile('u1', { dateOfBirth: '2999-01-01' }),
    ).rejects.toThrow(BadRequestException);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe('UsersService updateProfile privacy settings', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  function mockUpdate() {
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValue({
      set: (arg: Record<string, unknown>) => {
        sets.push(arg);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser, ...arg }]),
          }),
        };
      },
    });
    return sets;
  }

  it('writes only the toggle carried by the patch', async () => {
    const sets = mockUpdate();

    const result = await service.updateProfile('u1', {
      discoverableByEmail: false,
    });

    expect(sets[0]).toMatchObject({ discoverableByEmail: false });
    expect(sets[0]).not.toHaveProperty('discoverableByPhone');
    expect(sets[0]).not.toHaveProperty('discoverableByLocation');
    expect(sets[0].updatedAt).toBeInstanceOf(Date);
    expect(result.discoverableByEmail).toBe(false);
  });

  it('writes all five when all five are sent', async () => {
    const sets = mockUpdate();

    await service.updateProfile('u1', {
      discoverableByGender: true,
      discoverableByDateOfBirth: true,
      discoverableByPhone: false,
      discoverableByEmail: false,
      discoverableByLocation: false,
    });

    expect(sets[0]).toMatchObject({
      discoverableByGender: true,
      discoverableByDateOfBirth: true,
      discoverableByPhone: false,
      discoverableByEmail: false,
      discoverableByLocation: false,
    });
  });

  it('does not pre-read the profile for a privacy-only patch', async () => {
    mockUpdate();

    await service.updateProfile('u1', { discoverableByPhone: false });

    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('UpdateProfileDto privacy validation', () => {
  it('rejects a non-boolean privacy value', async () => {
    const errors = await validate(
      plainToInstance(UpdateProfileDto, { discoverableByEmail: 'yes' }),
    );

    expect(errors.some((e) => e.property === 'discoverableByEmail')).toBe(true);
  });

  it('accepts booleans', async () => {
    const errors = await validate(
      plainToInstance(UpdateProfileDto, { discoverableByEmail: false }),
    );

    expect(errors).toHaveLength(0);
  });

  it.each(['en', 'km'])('accepts preferredLanguage %s', async (language) => {
    const errors = await validate(
      plainToInstance(UpdateProfileDto, { preferredLanguage: language }),
    );

    expect(errors).toHaveLength(0);
  });

  it.each(['zh', 'ko', 'id', 'vi'])(
    'rejects preferredLanguage %s',
    async (language) => {
      const errors = await validate(
        plainToInstance(UpdateProfileDto, { preferredLanguage: language }),
      );

      expect(errors.some((e) => e.property === 'preferredLanguage')).toBe(true);
    },
  );
});

describe('UsersService updateProfile username generation', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  it('generates when free', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        // current-user fetch
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ ...fakeUser, username: null }]),
            }),
          }),
        };
      }
      // collision check: john-doe → free
      return {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      };
    });

    let capturedUpdateData: Record<string, unknown> = {};
    db.update.mockImplementation(() => ({
      set: (data: Record<string, unknown>) => {
        capturedUpdateData = data;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser, ...data }]),
          }),
        };
      },
    }));

    await service.updateProfile('u1', { firstName: 'John', lastName: 'Doe' });
    expect(capturedUpdateData.username).toBe('john-doe');
  });

  it('appends suffix on collision', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ ...fakeUser, username: null }]),
            }),
          }),
        };
      }
      if (selectCall === 2) {
        // john-doe → taken
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([{ id: 'x' }]) }),
          }),
        };
      }
      // john-doe-2 → free
      return {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      };
    });

    let capturedUpdateData: Record<string, unknown> = {};
    db.update.mockImplementation(() => ({
      set: (data: Record<string, unknown>) => {
        capturedUpdateData = data;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser, ...data }]),
          }),
        };
      },
    }));

    await service.updateProfile('u1', { firstName: 'John', lastName: 'Doe' });
    expect(capturedUpdateData.username).toBe('john-doe-2');
  });

  it('tries multiple suffixes on multiple collisions', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ ...fakeUser, username: null }]),
            }),
          }),
        };
      }
      if (selectCall === 2 || selectCall === 3) {
        // john-doe and john-doe-2 → taken
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([{ id: 'x' }]) }),
          }),
        };
      }
      // john-doe-3 → free
      return {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      };
    });

    let capturedUpdateData: Record<string, unknown> = {};
    db.update.mockImplementation(() => ({
      set: (data: Record<string, unknown>) => {
        capturedUpdateData = data;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser, ...data }]),
          }),
        };
      },
    }));

    await service.updateProfile('u1', { firstName: 'John', lastName: 'Doe' });
    expect(capturedUpdateData.username).toBe('john-doe-3');
  });

  it('does not overwrite an existing username', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([{ ...fakeUser, username: 'existing' }]),
            }),
          }),
        };
      }
      // should never reach collision check
      return {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      };
    });

    let capturedUpdateData: Record<string, unknown> = {};
    db.update.mockImplementation(() => ({
      set: (data: Record<string, unknown>) => {
        capturedUpdateData = data;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser, ...data }]),
          }),
        };
      },
    }));

    await service.updateProfile('u1', { firstName: 'John', lastName: 'Doe' });
    expect(capturedUpdateData.username).toBeUndefined();
    // only one select call: current-user fetch; no collision-check select
    expect(selectCall).toBe(1);
  });

  it('generates from firstName only', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ ...fakeUser, username: null }]),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      };
    });

    let capturedUpdateData: Record<string, unknown> = {};
    db.update.mockImplementation(() => ({
      set: (data: Record<string, unknown>) => {
        capturedUpdateData = data;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser, ...data }]),
          }),
        };
      },
    }));

    await service.updateProfile('u1', { firstName: 'John' });
    expect(capturedUpdateData.username).toBe('john');
  });

  it('generates from lastName only', async () => {
    let selectCall = 0;
    db.select.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ ...fakeUser, username: null }]),
            }),
          }),
        };
      }
      return {
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      };
    });

    let capturedUpdateData: Record<string, unknown> = {};
    db.update.mockImplementation(() => ({
      set: (data: Record<string, unknown>) => {
        capturedUpdateData = data;
        return {
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser, ...data }]),
          }),
        };
      },
    }));

    await service.updateProfile('u1', { lastName: 'Doe' });
    expect(capturedUpdateData.username).toBe('doe');
  });

  it('skips generation when no name field in DTO', async () => {
    db.update.mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...fakeUser, company: 'X' }]),
        }),
      }),
    });

    await service.updateProfile('u1', { company: 'X' });

    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('UsersService blocks', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  describe('blockUser', () => {
    it('throws BadRequestException when blocking yourself', async () => {
      await expect(service.blockUser('u1', { userId: 'u1' })).rejects.toThrow(
        BadRequestException,
      );
      expect(db.select).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when target is missing or soft-deleted', async () => {
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([]) }),
        }),
      });

      await expect(service.blockUser('u1', { userId: 'u2' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('inserts idempotently and returns { blocked: true }', async () => {
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ limit: () => Promise.resolve([{ id: 'u2' }]) }),
        }),
      });
      const onConflictDoNothing = jest.fn().mockResolvedValue([]);
      db.insert.mockReturnValue({ values: () => ({ onConflictDoNothing }) });

      const result = await service.blockUser('u1', { userId: 'u2' });

      expect(result).toEqual({ blocked: true });
      expect(onConflictDoNothing).toHaveBeenCalled();
    });
  });

  describe('unblockUser', () => {
    it('throws NotFoundException when no block exists', async () => {
      db.delete.mockReturnValue({
        where: () => ({ returning: () => Promise.resolve([]) }),
      });

      await expect(service.unblockUser('u1', 'u2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns { removed: true } when the block is deleted', async () => {
      db.delete.mockReturnValue({
        where: () => ({
          returning: () =>
            Promise.resolve([{ id: 'b1', blockerId: 'u1', blockedId: 'u2' }]),
        }),
      });

      await expect(service.unblockUser('u1', 'u2')).resolves.toEqual({
        removed: true,
      });
    });
  });

  describe('listBlocks', () => {
    it('returns [] without a profile query when no blocks exist', async () => {
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ orderBy: () => Promise.resolve([]) }),
        }),
      });

      await expect(service.listBlocks('u1')).resolves.toEqual([]);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('maps blocked user profiles onto block rows', async () => {
      const createdAt = new Date();
      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: () => ({
              where: () => ({
                orderBy: () =>
                  Promise.resolve([
                    { id: 'b1', blockerId: 'u1', blockedId: 'u2', createdAt },
                  ]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            where: () =>
              Promise.resolve([
                { id: 'u2', username: 'dara', profilePhotoUrl: null },
              ]),
          }),
        };
      });

      await expect(service.listBlocks('u1')).resolves.toEqual([
        {
          id: 'b1',
          blockedUser: { id: 'u2', username: 'dara', profilePhotoUrl: null },
          createdAt,
        },
      ]);
    });
  });
});

describe('UsersService follows', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;
  let notify: jest.Mock;

  beforeEach(() => {
    db = makeDb();
    notify = jest.fn().mockResolvedValue(undefined);
    service = makeService(db, {}, { notify });
  });

  describe('followUser', () => {
    it('throws BadRequestException when following yourself', async () => {
      await expect(service.followUser('u1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(db.select).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target is missing or soft-deleted', async () => {
      db.select.mockReturnValue(chain([]));

      await expect(service.followUser('u1', 'u2')).rejects.toThrow(
        NotFoundException,
      );
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('refuses when either side has blocked the other', async () => {
      db.select
        .mockReturnValueOnce(chain([{ id: 'u2' }])) // target exists
        .mockReturnValueOnce(chain([{ id: 'block-1' }])); // a block exists

      await expect(service.followUser('u1', 'u2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(db.insert).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });

    it('notifies the followed user when the edge is new', async () => {
      db.select
        .mockReturnValueOnce(chain([{ id: 'u2' }]))
        .mockReturnValueOnce(chain([]))
        .mockReturnValueOnce(
          chain([{ username: 'sokdara', firstName: 'Sok', lastName: 'Dara' }]),
        );
      db.insert.mockReturnValue({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([{ id: 'f1' }]),
          }),
        }),
      });

      await expect(service.followUser('u1', 'u2')).resolves.toEqual({
        following: true,
      });
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u2',
          type: 'follow.created',
          title: 'Sok Dara started following you',
        }),
      );
    });

    it('does not notify again when the edge already existed', async () => {
      db.select
        .mockReturnValueOnce(chain([{ id: 'u2' }]))
        .mockReturnValueOnce(chain([]));
      // The unique pair index swallowed the insert, so nothing came back.
      db.insert.mockReturnValue({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([]),
          }),
        }),
      });

      await expect(service.followUser('u1', 'u2')).resolves.toEqual({
        following: true,
      });
      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe('unfollowUser', () => {
    it('resolves rather than 404s when the edge is already gone', async () => {
      db.delete.mockReturnValue({ where: () => Promise.resolve([]) });

      await expect(service.unfollowUser('u1', 'u2')).resolves.toEqual({
        following: false,
      });
    });
  });

  describe('getFollowCounts', () => {
    it('counts followers by following_id and following by follower_id', async () => {
      db.select
        .mockReturnValueOnce(chain([{ value: 3 }]))
        .mockReturnValueOnce(chain([{ value: 5 }]));

      await expect(service.getFollowCounts('u1')).resolves.toEqual({
        followers: 3,
        following: 5,
      });
    });
  });

  describe('listFollowers', () => {
    it('returns the follower side of each edge, in edge order, flagged for the viewer', async () => {
      db.select
        .mockReturnValueOnce(chain([{ userId: 'u2' }, { userId: 'u3' }])) // edges
        .mockReturnValueOnce(chain([{ value: 2 }])) // total
        .mockReturnValueOnce(
          chain([
            {
              id: 'u2',
              username: 'dara',
              firstName: null,
              lastName: null,
              profilePhotoUrl: null,
            },
            {
              id: 'u3',
              username: 'neang',
              firstName: null,
              lastName: null,
              profilePhotoUrl: null,
            },
          ]),
        ) // profiles
        .mockReturnValueOnce(chain([{ id: 'u3' }])); // viewer already follows u3

      const result = await service.listFollowers('u1', 'u9', {});

      expect(result.data.map((u) => [u.username, u.isFollowing])).toEqual([
        ['dara', false],
        ['neang', true],
      ]);
      expect(result.meta).toMatchObject({ total: 2, hasMore: false, page: 1 });
    });

    it('drops a soft-deleted profile from the page', async () => {
      db.select
        .mockReturnValueOnce(chain([{ userId: 'u2' }, { userId: 'gone' }]))
        .mockReturnValueOnce(chain([{ value: 2 }]))
        .mockReturnValueOnce(
          chain([
            {
              id: 'u2',
              username: 'dara',
              firstName: null,
              lastName: null,
              profilePhotoUrl: null,
            },
          ]),
        ) // 'gone' was filtered out by the isNull(deletedAt) predicate
        .mockReturnValueOnce(chain([]));

      const result = await service.listFollowers('u1', 'u9', {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].username).toBe('dara');
    });
  });
});

describe('UsersService self-service account changes', () => {
  let db: ReturnType<typeof makeDb>;
  let service: UsersService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db, {
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: jest.fn().mockResolvedValue({
        data: { user: { id: 'supabase-id' } },
        error: null,
      }),
    });
  });

  describe('changeUsername', () => {
    function sequenceSelects(results: unknown[][]) {
      let call = 0;
      db.select.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(results[call++] ?? []),
          }),
        }),
      }));
    }

    function mockHistoryInsert() {
      const values = jest.fn();
      const onConflictDoUpdate = jest.fn(() => Promise.resolve());
      db.insert.mockReturnValue({
        values: (row: unknown) => {
          values(row);
          return { onConflictDoUpdate };
        },
      });
      return { values, onConflictDoUpdate };
    }

    function mockUpdate() {
      db.update.mockReturnValue({
        set: (values: Record<string, unknown>) => ({
          where: () => ({
            returning: () => Promise.resolve([{ ...fakeUser, ...values }]),
          }),
        }),
      });
    }

    it('lowercases, trims and collapses hyphens before writing', async () => {
      sequenceSelects([[{ username: 'Old.Handle' }], []]);
      const history = mockHistoryInsert();
      mockUpdate();

      const result = await service.changeUsername('u1', {
        username: '  Sok--Dara  ',
      });

      expect(result.username).toBe('sok-dara');
      expect(history.values).toHaveBeenCalledWith({
        userId: 'u1',
        username: 'old.handle',
      });
    });

    it('keeps a Khmer handle intact', async () => {
      sequenceSelects([[{ username: 'old-handle' }], []]);
      mockHistoryInsert();
      mockUpdate();

      const result = await service.changeUsername('u1', {
        username: 'សុខ-ដារា',
      });

      expect(result.username).toBe('សុខ-ដារា');
    });

    it('rejects a candidate that normalizes out of shape', async () => {
      for (const username of ['ab', 'sok dara', 'sok@dara']) {
        await expect(
          service.changeUsername('u1', { username }),
        ).rejects.toThrow(BadRequestException);
      }
      expect(db.select).not.toHaveBeenCalled();
    });

    it('refuses a username another account already holds', async () => {
      sequenceSelects([[{ username: 'old.handle' }], [{ id: 'someone-else' }]]);

      await expect(
        service.changeUsername('u1', { username: 'sokdara' }),
      ).rejects.toThrow(ConflictException);
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('matches the existing handle case-insensitively, even under -2', async () => {
      let call = 0;
      const wheres: unknown[] = [];
      db.select.mockImplementation(() => ({
        from: () => ({
          where: (where: unknown) => {
            wheres.push(where);
            return {
              limit: () =>
                Promise.resolve(call++ === 0 ? [{ username: 'old' }] : []),
            };
          },
        }),
      }));
      mockHistoryInsert();
      mockUpdate();

      await service.changeUsername('u1', { username: 'SokDara' });

      const probe = new PgDialect().sqlToQuery(wheres[1] as never);
      expect(probe.sql).toContain('lower(');
      expect(probe.sql).toContain('"username"');
      expect(probe.params).toContain('sokdara');
    });

    it('writes no alias for a case-only change', async () => {
      sequenceSelects([[{ username: 'sokdara' }], []]);
      const history = mockHistoryInsert();
      mockUpdate();

      await service.changeUsername('u1', { username: 'SokDara' });

      expect(history.values).not.toHaveBeenCalled();
    });

    it('writes no alias when the account had no username', async () => {
      sequenceSelects([[{ username: null }], []]);
      const history = mockHistoryInsert();
      mockUpdate();

      await service.changeUsername('u1', { username: 'sok-dara' });

      expect(history.values).not.toHaveBeenCalled();
    });

    it('maps the check-then-write race onto a 409', async () => {
      sequenceSelects([[{ username: 'old.handle' }], []]);
      db.update.mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () =>
              Promise.reject(
                Object.assign(new Error('duplicate key'), {
                  code: '23505',
                  constraint_name: 'users_username_active_uq',
                }),
              ),
          }),
        }),
      });

      await expect(
        service.changeUsername('u1', { username: 'sokdara' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password and writes nothing', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([{ id: 'u1', passwordHash: '$2b$10$hash' }]),
          }),
        }),
      });

      await expect(
        service.changePassword('u1', {
          currentPassword: 'wrong-pass',
          newPassword: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(db.update).not.toHaveBeenCalled();
    });

    it('refuses an account that has no password yet', async () => {
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: 'u1', passwordHash: null }]),
          }),
        }),
      });

      await expect(
        service.changePassword('u1', {
          currentPassword: 'whatever',
          newPassword: 'password123',
        }),
      ).rejects.toThrow('PASSWORD_NOT_SET');
    });

    it('stores a bcrypt hash of the new password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newhash');
      const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
      service = makeService(db, {}, notifications);
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([{ id: 'u1', passwordHash: '$2b$10$hash' }]),
          }),
        }),
      });
      const sets: Record<string, unknown>[] = [];
      db.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          return { where: () => Promise.resolve([]) };
        },
      }));

      await service.changePassword('u1', {
        currentPassword: 'password123',
        newPassword: 'password456',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password456', 10);
      expect(sets).toContainEqual(
        expect.objectContaining({
          passwordHash: '$2b$10$newhash',
          // Every session and any outstanding reset proof minted before this
          // change must stop working.
          tokensValidAfter: expect.any(Date) as unknown as Date,
        }),
      );
      // Same record the reset flow writes, so the owner can see why the other
      // devices were signed out.
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'security.password_changed' }),
      );
    });
  });

  describe('deleteOwnAccount', () => {
    it('soft-deletes but keeps the phone the recovery window matches on', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([{ id: 'u1', passwordHash: '$2b$10$hash' }]),
          }),
        }),
      });
      const sets: Record<string, unknown>[] = [];
      db.update.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          return { where: () => Promise.resolve([]) };
        },
      }));

      await service.deleteOwnAccount('u1', { password: 'password123' });

      const deletion = sets.find((values) => 'deletedAt' in values);
      expect(deletion).toMatchObject({ status: 'deleted' });
      expect(deletion?.deletedAt).toBeInstanceOf(Date);
      // Nothing may null the identifiers: a null primaryPhone is what marks
      // an ADMIN deletion, and only the sweeper is allowed to remove rows.
      expect(sets).not.toContainEqual(
        expect.objectContaining({ primaryPhone: null }),
      );
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('rejects a wrong password without deactivating anything', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([{ id: 'u1', passwordHash: '$2b$10$hash' }]),
          }),
        }),
      });

      await expect(
        service.deleteOwnAccount('u1', { password: 'wrong-pass' }),
      ).rejects.toThrow(BadRequestException);
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyPhoneChangeOtp', () => {
    it('rejects an invalid OTP without touching the account', async () => {
      const service = makeService(db, {
        verifyOtp: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'invalid' },
        }),
      });

      await expect(
        service.verifyPhoneChangeOtp('u1', {
          phone: '+85512345678',
          token: '999999',
        }),
      ).rejects.toThrow('INVALID_OTP');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('moves the primary row onto the new number and stamps phoneVerifiedAt', async () => {
      const PHONE = '+85512345678';
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup, 2: users.primaryPhone owner check, 3:
        // user_phones owner check, 4: the current primary row, 5: findById
        // after the transaction
        const rows =
          selectCall === 4
            ? [{ id: 'p1' }]
            : selectCall === 5
              ? [{ ...fakeUser, primaryPhone: PHONE }]
              : [];
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
          return { where: () => Promise.resolve([]) };
        },
      }));
      const inserted: Record<string, unknown>[] = [];
      db.insert.mockImplementation(() => ({
        values: (values: Record<string, unknown>) => {
          inserted.push(values);
          return { onConflictDoNothing: () => Promise.resolve([]) };
        },
      }));

      const result = await service.verifyPhoneChangeOtp('u1', {
        phone: PHONE,
        token: '000000',
      });

      expect(result.primaryPhone).toBe(PHONE);
      expect(sets).toContainEqual({ phone: PHONE });
      const verified = sets.find((values) => 'phoneVerifiedAt' in values);
      expect(verified).toMatchObject({ primaryPhone: PHONE });
      expect(verified?.phoneVerifiedAt).toBeInstanceOf(Date);
      expect(inserted).toContainEqual(
        expect.objectContaining({ userId: 'u1', provider: 'phone' }),
      );
    });

    it('refuses a number another account already owns', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        // 1: banned-phone lookup → not banned; 2: phone owner check
        const rows = selectCall === 1 ? [] : [{ id: 'someone-else' }];
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(rows) }),
          }),
        };
      });

      await expect(
        service.verifyPhoneChangeOtp('u1', {
          phone: '+85512345678',
          token: '000000',
        }),
      ).rejects.toThrow(ConflictException);
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });
});

describe('UsersService public profile visibility', () => {
  it('does not expose a moderation-suspended account, and never aliases it', async () => {
    const db = makeDb();
    const wheres: unknown[] = [];
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      const c: Record<string, unknown> = {};
      c.from = () => c;
      c.where = (arg: unknown) => {
        wheres.push(arg);
        return c;
      };
      // 1: active lookup → miss; 2: holder probe → the suspended account.
      c.limit = () => Promise.resolve(call === 2 ? [{ id: 'suspended' }] : []);
      return c;
    });
    const service = makeService(db);

    await expect(service.getPublicProfile('sokdara')).rejects.toThrow(
      NotFoundException,
    );

    const { sql } = new PgDialect().sqlToQuery(wheres[0] as never);
    expect(sql).toContain('"status" = $');
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('lower(');
    // The handle still belongs to an account: history is never consulted.
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('resolves a released handle only when no account holds it', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      if (call === 1) return chain([]); // no active holder
      if (call === 2) return chain([]); // no suspended/deleted holder
      if (call === 3) return chain([{ userId: fakeUser.id }]); // alias row
      if (call === 4) return chain([fakeUser]); // active row by id
      if (call === 7) return chain([]); // subscription probe
      return chain([{ value: 0 }]); // follow counts
    });
    const service = makeService(db);

    const profile = await service.getPublicProfile('released-handle');

    expect(profile.username).toBe(fakeUser.username);
    expect(db.select).toHaveBeenCalledTimes(7);
  });

  it('a history alias to an account that is not publicly viewable is a 404', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      if (call === 3) return chain([{ userId: 'gone' }]);
      return chain([]);
    });
    const service = makeService(db);

    await expect(service.getPublicProfile('former-handle')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('a case-insensitive current holder wins over the history table', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      if (call === 1) return chain([fakeUser]);
      if (call === 4) return chain([]);
      return chain([{ value: 0 }]);
    });
    const service = makeService(db);

    const profile = await service.getPublicProfile('SOKDARA');

    expect(profile.username).toBe(fakeUser.username);
    // user row + follow counts + subscription probe — history never read.
    expect(db.select).toHaveBeenCalledTimes(4);
  });
});

describe('UsersService verified account flag', () => {
  it('marks a public profile with an active paid subscription', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      // 1: the user row, 2-3: follower/following counts, 4: subscription probe.
      if (call === 1) return chain([fakeUser]);
      if (call === 4) return chain([{ id: 'sub-1' }]);
      return chain([{ value: 0 }]);
    });
    const service = makeService(db);

    const profile = await service.getPublicProfile('sokdara');

    expect(profile.verifiedAccount).toBe(true);
  });

  it('leaves a public profile without a paid subscription unverified', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      if (call === 1) return chain([fakeUser]);
      if (call === 4) return chain([]);
      return chain([{ value: 0 }]);
    });
    const service = makeService(db);

    const profile = await service.getPublicProfile('sokdara');

    expect(profile.verifiedAccount).toBe(false);
  });

  it('carries the flag on the signed-in user read', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      const rows: Record<string, unknown>[] =
        call === 1 ? [fakeUser] : [{ id: 'sub-1' }];
      return chain(rows);
    });
    const service = makeService(db);

    const me = await service.findById('u1');

    expect(me.verifiedAccount).toBe(true);
  });

  it('omits linked providers unless the caller opts in', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      const rows: Record<string, unknown>[] =
        call === 1 ? [fakeUser] : [{ id: 'sub-1' }];
      return chain(rows);
    });
    const service = makeService(db);

    const me = await service.findById('u1');

    expect(me).not.toHaveProperty('authProviders');
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('returns the linked providers in a stable order when requested', async () => {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      const rows: Record<string, unknown>[] =
        call === 1
          ? [fakeUser]
          : call === 2
            ? [{ id: 'sub-1' }]
            : [{ provider: 'telegram' }, { provider: 'google' }];
      return chain(rows);
    });
    const service = makeService(db);

    const me = await service.findById('u1', true);

    expect(me.authProviders).toEqual(['google', 'telegram']);
    expect(db.select).toHaveBeenCalledTimes(3);
  });
});

describe('UsersService getPublicProfileById', () => {
  const PROFILE_ID = '18d78b3e-1767-43b5-b4a0-947c2b5f8e1f';
  const PRIVATE_ROW = {
    ...fakeUser,
    id: PROFILE_ID,
    primaryPhone: '+85512345678',
    email: 'victim@example.com',
    role: 'admin' as const,
    phoneVerifiedAt: new Date('2026-01-01T00:00:00Z'),
  };

  /** 1: the user row, 2-3: follow counts, 4: subscription probe. */
  function makeProfileDb(rows: Record<string, unknown>[]) {
    const db = makeDb();
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      if (call === 1) return chain(rows);
      if (call === 4) return chain([{ id: 'sub-1' }]);
      return chain([{ value: 0 }]);
    });
    return db;
  }

  it("does not expose another user's phone, email, role or moderation state", async () => {
    const service = makeService(makeProfileDb([PRIVATE_ROW]));

    const profile = await service.getPublicProfileById(PROFILE_ID);

    expect(profile).toEqual({
      id: PROFILE_ID,
      username: fakeUser.username,
      firstName: fakeUser.firstName,
      lastName: fakeUser.lastName,
      profilePhotoUrl: fakeUser.profilePhotoUrl,
      coverPhotoUrl: fakeUser.coverPhotoUrl,
      isVerified: true,
      verifiedAccount: true,
      createdAt: fakeUser.createdAt,
      followers: 0,
      following: 0,
    });
    for (const key of [
      'primaryPhone',
      'email',
      'role',
      'status',
      'phoneVerifiedAt',
      'emailVerifiedAt',
      'passwordHash',
    ]) {
      expect(profile).not.toHaveProperty(key);
    }
  });

  it('reuses the same projection as the username lookup', async () => {
    const byId = await makeService(
      makeProfileDb([PRIVATE_ROW]),
    ).getPublicProfileById(PROFILE_ID);
    const byUsername = await makeService(
      makeProfileDb([PRIVATE_ROW]),
    ).getPublicProfile('sokdara');

    expect(byId).toEqual(byUsername);
  });

  it('is a 404 for an unknown id, like the username lookup', async () => {
    const service = makeService(makeProfileDb([]));

    await expect(service.getPublicProfileById(PROFILE_ID)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('UsersController GET /users/:id', () => {
  const PROFILE_ID = '18d78b3e-1767-43b5-b4a0-947c2b5f8e1f';
  const getPublicProfileById = jest.fn();
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: { getPublicProfileById } },
        { provide: BillingAddressesService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    getPublicProfileById.mockReset();
  });

  it('answers 400, not 500, for a non-UUID id', async () => {
    await request(app.getHttpServer()).get('/users/not-a-uuid').expect(400);

    expect(getPublicProfileById).not.toHaveBeenCalled();
  });

  it('serves the public projection instead of the full user row', async () => {
    getPublicProfileById.mockResolvedValue({ id: PROFILE_ID });

    await request(app.getHttpServer())
      .get(`/users/${PROFILE_ID}`)
      .expect(200)
      .expect({ id: PROFILE_ID });

    expect(getPublicProfileById).toHaveBeenCalledWith(PROFILE_ID);
  });
});

/**
 * Chainable stub for the two selects `searchUsers` issues. The row select ends
 * in `.offset()`, the count select is awaited directly; both record what the
 * service asked for so the generated SQL can be compiled and asserted.
 */
function searchDb(
  rows: Array<Record<string, unknown>>,
  total: number,
  capture: {
    where?: unknown;
    orderBy?: unknown[];
    limit?: number;
    offset?: number;
    fields?: Record<string, unknown>;
  } = {},
) {
  const db = makeDb();
  let call = 0;
  db.select.mockImplementation((fields: unknown) => {
    call += 1;
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.where = (arg: unknown) => {
      capture.where = arg;
      return c;
    };
    if (call === 1) {
      c.orderBy = (...args: unknown[]) => {
        capture.orderBy = args;
        return c;
      };
      c.limit = (value: number) => {
        capture.limit = value;
        return c;
      };
      c.offset = (value: number) => {
        capture.offset = value;
        capture.fields = fields as Record<string, unknown>;
        return Promise.resolve(rows);
      };
      c.then = (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(rows).then(resolve);
    } else {
      c.then = (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve([{ value: total }]).then(resolve);
    }
    return c;
  });
  return db;
}

describe('UsersService searchUsers', () => {
  it('filters to active, non-deleted, username-bearing users and prefix-matches every token', async () => {
    const capture: { where?: unknown } = {};
    const service = makeService(searchDb([], 0, capture));

    await service.searchUsers('sak', 1, 3);

    const { sql, params } = new PgDialect().sqlToQuery(capture.where as never);
    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('"status" = $');
    expect(sql).toContain('"role" = $');
    expect(sql).toContain('"username" is not null');
    expect(params).toContain('active');
    expect(params).toContain('user');
    expect(params).toContain('sak%');
    expect(params).not.toContain('%sak%');
  });

  it('treats the caller’s LIKE wildcards literally', async () => {
    const capture: { where?: unknown } = {};
    const service = makeService(searchDb([], 0, capture));

    await service.searchUsers('50% a_b', 1, 3);

    const { params } = new PgDialect().sqlToQuery(capture.where as never);
    expect(params).toContain('50\\%%');
    expect(params).toContain('a\\_b%');
  });

  it('caps the query at five tokens', async () => {
    const capture: { where?: unknown } = {};
    const service = makeService(searchDb([], 0, capture));

    await service.searchUsers('a b c d e f', 1, 3);

    const { params } = new PgDialect().sqlToQuery(capture.where as never);
    expect(params).toContain('e%');
    expect(params).not.toContain('f%');
  });

  it('returns the public allow-list without contact or moderation fields', async () => {
    const rows = [
      {
        id: 'u1',
        username: 'sakkuna',
        firstName: 'Sakkuna',
        lastName: 'Suon',
        profilePhotoUrl: null,
        verifiedAccount: true,
        email: 'leak@example.com',
        primaryPhone: '+85510000000',
      },
    ];
    const db = searchDb(rows, 1);
    const service = makeService(db);

    const result = await service.searchUsers('sak', 1, 3);

    expect(result.data).toEqual([
      {
        id: 'u1',
        username: 'sakkuna',
        firstName: 'Sakkuna',
        lastName: 'Suon',
        profilePhotoUrl: null,
        verifiedAccount: true,
      },
    ]);
    const calls = db.select.mock.calls as unknown[][];
    const fields = calls[0][0] as Record<string, unknown>;
    expect(Object.keys(fields).sort()).toEqual([
      'firstName',
      'id',
      'lastName',
      'profilePhotoUrl',
      'username',
      'verifiedAccount',
    ]);
  });

  it('drops a row that somehow lost its username', async () => {
    const service = makeService(
      searchDb(
        [
          {
            id: 'u1',
            username: null,
            firstName: null,
            lastName: null,
            profilePhotoUrl: null,
            verifiedAccount: false,
          },
          {
            id: 'u2',
            username: 'sak',
            firstName: null,
            lastName: null,
            profilePhotoUrl: null,
            verifiedAccount: false,
          },
        ],
        2,
      ),
    );

    const result = await service.searchUsers('sak', 1, 3);

    expect(result.data.map((row) => row.id)).toEqual(['u2']);
  });

  it('pages with a deterministic order and reports the total', async () => {
    const capture: {
      where?: unknown;
      orderBy?: unknown[];
      limit?: number;
      offset?: number;
    } = {};
    const service = makeService(
      searchDb(
        [
          {
            id: 'u1',
            username: 'sak1',
            firstName: null,
            lastName: null,
            profilePhotoUrl: null,
            verifiedAccount: false,
          },
          {
            id: 'u2',
            username: 'sak2',
            firstName: null,
            lastName: null,
            profilePhotoUrl: null,
            verifiedAccount: false,
          },
          {
            id: 'u3',
            username: 'sak3',
            firstName: null,
            lastName: null,
            profilePhotoUrl: null,
            verifiedAccount: false,
          },
        ],
        7,
        capture,
      ),
    );

    const result = await service.searchUsers('sak', 2, 3);

    expect(capture.offset).toBe(3);
    expect(capture.limit).toBe(3);
    expect(capture.orderBy).toHaveLength(3);
    const orderExpression = capture.orderBy?.[0];
    expect(orderExpression).toBeDefined();
    const orderSql = new PgDialect().sqlToQuery(orderExpression as never).sql;
    expect(orderSql.toLowerCase()).toContain('case');
    expect(orderSql.toLowerCase()).toContain('ilike');
    expect(result.meta).toMatchObject({
      page: 2,
      pageSize: 3,
      limit: 3,
      total: 7,
      hasMore: true,
      nextCursor: null,
    });
  });

  it('reports the last page as complete', async () => {
    const service = makeService(
      searchDb(
        [
          {
            id: 'u1',
            username: 'sak',
            firstName: null,
            lastName: null,
            profilePhotoUrl: null,
            verifiedAccount: false,
          },
        ],
        4,
      ),
    );

    const result = await service.searchUsers('sak', 2, 3);

    expect(result.meta.hasMore).toBe(false);
  });

  it('does not advertise a page past the DTO cap', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({
      id: `u${index}`,
      username: `sak${index}`,
      firstName: null,
      lastName: null,
      profilePhotoUrl: null,
      verifiedAccount: false,
    }));
    const service = makeService(searchDb(rows, 5000));

    const result = await service.searchUsers('sak', 100, 3);

    expect(result.meta.hasMore).toBe(false);
  });

  it('does not turn a blank search into a directory dump', async () => {
    const db = makeDb();
    const service = makeService(db);

    const result = await service.searchUsers('   ', 1, 3);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });
});

describe('SearchUsersDto', () => {
  const errorsFor = async (raw: Record<string, unknown>) =>
    validate(
      plainToInstance(SearchUsersDto, raw, { enableImplicitConversion: true }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

  it('requires q and trims it', async () => {
    expect(await errorsFor({})).not.toHaveLength(0);
    expect(await errorsFor({ q: '   ' })).not.toHaveLength(0);

    const instance = plainToInstance(SearchUsersDto, { q: '  sak  ' });
    expect(instance.q).toBe('sak');
  });

  it('caps q at 100 characters', async () => {
    expect(await errorsFor({ q: 'a'.repeat(100) })).toHaveLength(0);
    expect(await errorsFor({ q: 'a'.repeat(101) })).not.toHaveLength(0);
  });

  it('defaults and caps pagination', async () => {
    const instance = plainToInstance(
      SearchUsersDto,
      { q: 'sak' },
      { enableImplicitConversion: true },
    );
    expect(instance.page).toBe(1);
    expect(instance.pageSize).toBe(20);

    expect(await errorsFor({ q: 'sak', page: 0 })).not.toHaveLength(0);
    expect(await errorsFor({ q: 'sak', page: 101 })).not.toHaveLength(0);
    expect(await errorsFor({ q: 'sak', pageSize: 0 })).not.toHaveLength(0);
    expect(await errorsFor({ q: 'sak', pageSize: 51 })).not.toHaveLength(0);
  });

  it('rejects a key this route does not declare', async () => {
    expect(await errorsFor({ q: 'sak', limit: 10 })).not.toHaveLength(0);
  });
});

describe('UsersController GET /users/search', () => {
  const searchUsers = jest.fn();
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: { searchUsers } },
        { provide: BillingAddressesService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    searchUsers.mockReset();
  });

  it('is public on the handler only', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      UsersController.prototype,
      'searchUsers',
    ) as { value?: object } | undefined;
    const handler = descriptor?.value;
    expect(handler).toBeDefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler as object)).toBe(true);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, UsersController)).toBeUndefined();
  });

  it('routes /users/search to the search handler, not ParseUUIDPipe', async () => {
    searchUsers.mockResolvedValue({ data: [], meta: {} });

    await request(app.getHttpServer())
      .get('/users/search?q=sak&pageSize=3')
      .expect(200);

    expect(searchUsers).toHaveBeenCalledWith('sak', 1, 3);
  });

  it('rejects a missing q and an undeclared query key', async () => {
    await request(app.getHttpServer()).get('/users/search').expect(400);
    await request(app.getHttpServer())
      .get('/users/search?q=sak&limit=10')
      .expect(400);

    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('keeps the :id UUID guard for /users/:id', async () => {
    await request(app.getHttpServer()).get('/users/not-a-uuid').expect(400);
  });
});

describe('ChangeUsernameDto', () => {
  it.each([['sok-dara'], ['សុខ-ដារា'], ['Sok.Dara_01'], ['  sok-dara  ']])(
    'accepts %p',
    async (username) => {
      const errors = await validate(
        plainToInstance(ChangeUsernameDto, { username }),
      );
      expect(errors).toHaveLength(0);
    },
  );

  it.each([['sok dara'], ['sok@dara'], ['a'.repeat(51)]])(
    'rejects %p',
    async (username) => {
      const errors = await validate(
        plainToInstance(ChangeUsernameDto, { username }),
      );
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    },
  );
});
