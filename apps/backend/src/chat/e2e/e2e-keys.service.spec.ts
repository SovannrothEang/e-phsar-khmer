import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { E2eKeysService } from './e2e-keys.service';
import { userE2eOneTimePrekeys } from '../../db/schema/chat.schema';
import type { RegisterE2eKeysDto } from './dto/register-e2e-keys.dto';

function makeTx() {
  return {
    // registerKeys reads the stored identityKey before upserting, to tell a
    // rotation from a replay. Default = no prior row, so no purge.
    select: jest.fn(() => limitQuery([])),
    insert: jest.fn(),
    delete: jest.fn((..._args: unknown[]) => ({
      where: (_predicate?: unknown) => Promise.resolve(undefined),
    })),
  };
}

function makeDb(tx: ReturnType<typeof makeTx>) {
  return {
    select: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn((cb: (tx: ReturnType<typeof makeTx>) => unknown) =>
      cb(tx),
    ),
  };
}

// .from().where().limit() → rows
function limitQuery(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  };
}

// .from().where() → rows
function whereQuery(rows: unknown[]) {
  return { from: () => ({ where: () => Promise.resolve(rows) }) };
}

function baseDto(
  overrides: Partial<RegisterE2eKeysDto> = {},
): RegisterE2eKeysDto {
  return {
    identityKey: 'idkey',
    identitySigningKey: 'idsignkey',
    registrationId: 1,
    signedPrekeyId: 1,
    signedPrekeyPublic: 'spk-pub',
    signedPrekeySignature: 'spk-sig',
    oneTimePrekeys: [{ prekeyId: 1, publicKey: 'otp-1' }],
    ...overrides,
  };
}

describe('E2eKeysService.registerKeys', () => {
  it('upserts the identity with onConflictDoUpdate targeting userId', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    const service = new E2eKeysService(db as never);

    const identityValues: Record<string, unknown>[] = [];
    let identityUpsertArgs: unknown;
    const otpValues: Record<string, unknown>[][] = [];

    tx.insert.mockImplementation(() => {
      // First call = identity upsert, second call = prekeys insert.
      if (tx.insert.mock.calls.length === 1) {
        return {
          values: (v: Record<string, unknown>) => {
            identityValues.push(v);
            return {
              onConflictDoUpdate: (args: unknown) => {
                identityUpsertArgs = args;
                return Promise.resolve(undefined);
              },
            };
          },
        };
      }
      return {
        values: (v: Record<string, unknown>[]) => {
          otpValues.push(v);
          return { onConflictDoNothing: () => Promise.resolve(undefined) };
        },
      };
    });

    const dto = baseDto();
    const result = await service.registerKeys('u1', dto);

    expect(identityValues[0]).toMatchObject({
      userId: 'u1',
      identityKey: 'idkey',
      identitySigningKey: 'idsignkey',
      registrationId: 1,
      signedPrekeyId: 1,
      signedPrekeyPublic: 'spk-pub',
      signedPrekeySignature: 'spk-sig',
    });
    expect(identityUpsertArgs).toHaveProperty('target');
    expect(result).toEqual({ accepted: 1 });
  });

  it('inserts one-time prekeys with onConflictDoNothing targeting (userId, prekeyId)', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    const service = new E2eKeysService(db as never);

    let conflictTarget: unknown;
    tx.insert.mockImplementation(() => ({
      values: () => ({
        onConflictDoUpdate: () => Promise.resolve(undefined),
        onConflictDoNothing: (args: { target: unknown }) => {
          conflictTarget = args.target;
          return Promise.resolve(undefined);
        },
      }),
    }));

    await service.registerKeys(
      'u1',
      baseDto({
        oneTimePrekeys: [
          { prekeyId: 1, publicKey: 'a' },
          { prekeyId: 2, publicKey: 'b' },
        ],
      }),
    );

    expect(Array.isArray(conflictTarget)).toBe(true);
    expect((conflictTarget as unknown[]).length).toBe(2);
  });

  it('skips the prekey insert entirely when oneTimePrekeys is empty', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    const service = new E2eKeysService(db as never);

    tx.insert.mockImplementation(() => ({
      values: () => ({ onConflictDoUpdate: () => Promise.resolve(undefined) }),
    }));

    const result = await service.registerKeys(
      'u1',
      baseDto({ oneTimePrekeys: [] }),
    );

    expect(tx.insert).toHaveBeenCalledTimes(1); // identity only
    expect(result).toEqual({ accepted: 0 });
  });

  // Both chains hang off one `.values()` result, so the identity upsert and
  // the prekey insert can share a single insert mock.
  function captureInserts(
    tx: ReturnType<typeof makeTx>,
    otpBatches: unknown[],
  ) {
    tx.insert.mockImplementation(() => ({
      values: (v: unknown) => ({
        onConflictDoUpdate: () => Promise.resolve(undefined),
        onConflictDoNothing: () => {
          otpBatches.push(v);
          return Promise.resolve(undefined);
        },
      }),
    }));
  }

  it('purges unused prekeys when the identity rotates', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    const service = new E2eKeysService(db as never);

    // A different identityKey means the client bootstrapped fresh key
    // material and is re-uploading prekey ids 1..N with NEW public keys —
    // every one of which would otherwise be discarded by the insert's
    // onConflictDoNothing, leaving a pool nobody can decrypt against.
    tx.select.mockReturnValue(limitQuery([{ identityKey: 'stale-idkey' }]));
    const whereArgs: unknown[] = [];
    tx.delete.mockImplementation(() => ({
      where: (pred: unknown) => {
        whereArgs.push(pred);
        return Promise.resolve(undefined);
      },
    }));
    const otpBatches: unknown[] = [];
    captureInserts(tx, otpBatches);

    const result = await service.registerKeys('u1', baseDto());

    expect(tx.delete.mock.calls[0][0]).toBe(userE2eOneTimePrekeys);
    expect(whereArgs).toHaveLength(1);
    // The purge must not cost the caller its new prekeys.
    expect(otpBatches).toHaveLength(1);
    expect(result).toEqual({ accepted: 1 });
  });

  it('keeps the pool when the same identity re-registers (retry or replenish)', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    const service = new E2eKeysService(db as never);

    // Same identityKey as the stored row: a retried registration, or the
    // steady-state replenish re-uploading an unchanged identity with a fresh
    // batch. Purging here would wipe the valid pool on every top-up.
    tx.select.mockReturnValue(limitQuery([{ identityKey: 'idkey' }]));
    const otpBatches: unknown[] = [];
    captureInserts(tx, otpBatches);

    await service.registerKeys('u1', baseDto());

    expect(tx.delete).not.toHaveBeenCalled();
    expect(otpBatches).toHaveLength(1);
  });
});

describe('E2eKeysService.getBundle', () => {
  it('throws ForbiddenException when a block exists in either direction', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    db.select.mockReturnValue(limitQuery([{ id: 'block-1' }])); // block check
    const service = new E2eKeysService(db as never);

    await expect(service.getBundle('caller1', 'u1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException when no identity row exists', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([]); // no block
      return limitQuery([]); // no identity
    });
    const service = new E2eKeysService(db as never);

    await expect(service.getBundle('caller1', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  const identity = {
    userId: 'u1',
    identityKey: 'idkey',
    identitySigningKey: 'idsignkey',
    registrationId: 1,
    signedPrekeyId: 1,
    signedPrekeyPublic: 'spk-pub',
    signedPrekeySignature: 'spk-sig',
  };

  it('returns oneTimePrekey: null when the pool is exhausted', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([]); // no block
      return limitQuery([identity]);
    });
    db.update.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    });
    const service = new E2eKeysService(db as never);

    const bundle = await service.getBundle('caller1', 'u1');

    expect(bundle.oneTimePrekey).toBeNull();
    expect(bundle.identityKey).toBe('idkey');
  });

  it('returns the claimed prekey when one is available', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return limitQuery([]); // no block
      return limitQuery([identity]);
    });
    db.update.mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () =>
            Promise.resolve([{ prekeyId: 5, publicKey: 'claimed-key' }]),
        }),
      }),
    });
    const service = new E2eKeysService(db as never);

    const bundle = await service.getBundle('caller1', 'u1');

    expect(bundle.oneTimePrekey).toEqual({
      prekeyId: 5,
      publicKey: 'claimed-key',
    });
  });
});

describe('E2eKeysService.getPrekeyCount', () => {
  it('returns 0 when no rows', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    db.select.mockReturnValue(whereQuery([]));
    const service = new E2eKeysService(db as never);

    await expect(service.getPrekeyCount('u1')).resolves.toEqual({
      available: 0,
    });
  });

  it('returns the actual count otherwise', async () => {
    const tx = makeTx();
    const db = makeDb(tx);
    db.select.mockReturnValue(whereQuery([{ count: 7 }]));
    const service = new E2eKeysService(db as never);

    await expect(service.getPrekeyCount('u1')).resolves.toEqual({
      available: 7,
    });
  });
});
