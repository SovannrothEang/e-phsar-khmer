import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';

function makeDb() {
  const db = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return db;
}

function makeService(db: ReturnType<typeof makeDb>) {
  const service = new UsersService(db as never, {} as never, {} as never);
  (service as unknown as { db: unknown }).db = db;
  return service;
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
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: 'existing' }]),
          }),
        }),
      });

      await expect(
        service.addPhone('u1', { phone: '+855123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('demotes other phones when isPrimary=true on second phone', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
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
  });

  describe('removePhone', () => {
    it('throws NotFoundException when delete returns no rows', async () => {
      db.delete.mockReturnValue({
        where: () => ({ returning: () => Promise.resolve([]) }),
      });

      await expect(service.removePhone('u1', 'p1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns { removed: true } when phone deleted', async () => {
      const deleted = {
        id: 'p1',
        userId: 'u1',
        phone: '+855123',
        isPrimary: false,
      };
      db.delete.mockReturnValue({
        where: () => ({ returning: () => Promise.resolve([deleted]) }),
      });

      const result = await service.removePhone('u1', 'p1');
      expect(result).toEqual({ removed: true });
    });
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
  lastSeenAt: null,
  emailVerifiedAt: null,
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
      // collision check: johndoe → free
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
    expect(capturedUpdateData.username).toBe('johndoe');
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
        // johndoe → taken
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([{ id: 'x' }]) }),
          }),
        };
      }
      // johndoe2 → free
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
    expect(capturedUpdateData.username).toBe('johndoe2');
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
        // johndoe and johndoe2 → taken
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([{ id: 'x' }]) }),
          }),
        };
      }
      // johndoe3 → free
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
    expect(capturedUpdateData.username).toBe('johndoe3');
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
