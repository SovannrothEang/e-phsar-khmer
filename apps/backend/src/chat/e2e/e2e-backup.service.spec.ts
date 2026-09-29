import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  E2eBackupService,
  hashKeyProof,
  PASSCODE_MAX_ATTEMPTS,
} from './e2e-backup.service';

// .set().where().returning() → rows
function updateReturning(rows: unknown[], sets: unknown[] = []) {
  return {
    set: (v: unknown) => {
      sets.push(v);
      return {
        where: () => {
          const p = Promise.resolve(undefined) as Promise<undefined> & {
            returning: () => Promise<unknown[]>;
          };
          p.returning = () => Promise.resolve(rows);
          return p;
        },
      };
    },
  };
}

// .from().where().limit() → rows
function limitQuery(rows: unknown[]) {
  return {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  };
}

function makeDb() {
  return { select: jest.fn(), update: jest.fn(), insert: jest.fn() };
}

describe('E2eBackupService.unlock', () => {
  let authHash: string;
  beforeAll(async () => {
    authHash = await bcrypt.hash('right-auth-key', 4);
  });

  it('returns the wrapped key and resets the counter on the right passcode', async () => {
    const db = makeDb();
    const sets: unknown[] = [];
    db.update
      .mockReturnValueOnce(
        updateReturning([
          { passcodeAuthHash: authHash, wrappedKey: 'wk', failedAttempts: 1 },
        ]),
      )
      .mockReturnValueOnce(updateReturning([], sets));
    const service = new E2eBackupService(db as never);

    await expect(service.unlock('u1', 'right-auth-key')).resolves.toEqual({
      wrappedKey: 'wk',
    });
    expect(sets[0]).toEqual({ failedAttempts: 0, lockedUntil: null });
  });

  it('rejects a wrong passcode with attemptsLeft, no lock yet', async () => {
    const db = makeDb();
    db.update.mockReturnValueOnce(
      updateReturning([
        { passcodeAuthHash: authHash, wrappedKey: 'wk', failedAttempts: 2 },
      ]),
    );
    const service = new E2eBackupService(db as never);

    const err = await service.unlock('u1', 'wrong').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'E2E_PASSCODE_WRONG',
      details: { attemptsLeft: PASSCODE_MAX_ATTEMPTS - 2, lockedUntil: null },
    });
    expect(db.update).toHaveBeenCalledTimes(1); // no lock write
  });

  it('locks the backup on the last allowed wrong attempt', async () => {
    const db = makeDb();
    const sets: { lockedUntil?: Date }[] = [];
    db.update
      .mockReturnValueOnce(
        updateReturning([
          {
            passcodeAuthHash: authHash,
            wrappedKey: 'wk',
            failedAttempts: PASSCODE_MAX_ATTEMPTS,
          },
        ]),
      )
      .mockReturnValueOnce(updateReturning([], sets));
    const service = new E2eBackupService(db as never);

    const err = await service.unlock('u1', 'wrong').catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      details: { attemptsLeft: 0 },
    });
    const lockedUntil = sets[0].lockedUntil!;
    expect(lockedUntil.getTime()).toBeGreaterThan(Date.now() + 59 * 60_000);
  });

  it('refuses with 429 while locked, without comparing', async () => {
    const db = makeDb();
    const lockedUntil = new Date(Date.now() + 3_600_000);
    db.update.mockReturnValueOnce(updateReturning([])); // guarded UPDATE matched nothing
    db.select.mockReturnValueOnce(
      limitQuery([
        {
          keyCheck: 'kc',
          wrappedKey: 'wk',
          passcodeAuthHash: authHash,
          lockedUntil,
        },
      ]),
    );
    const service = new E2eBackupService(db as never);

    const err = await service
      .unlock('u1', 'right-auth-key')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'E2E_PASSCODE_LOCKED',
    });
  });

  it('404s when no passcode was ever set', async () => {
    const db = makeDb();
    db.update.mockReturnValueOnce(updateReturning([]));
    db.select.mockReturnValueOnce(
      limitQuery([
        { keyCheck: 'kc', wrappedKey: null, passcodeAuthHash: null },
      ]),
    );
    const service = new E2eBackupService(db as never);

    await expect(service.unlock('u1', 'x')).rejects.toThrow(NotFoundException);
  });
});

describe('E2eBackupService.setPasscode', () => {
  it('409s when the caller holds a different backup key', async () => {
    const db = makeDb();
    db.update.mockReturnValueOnce(updateReturning([]));
    const service = new E2eBackupService(db as never);

    await expect(
      service.setPasscode('u1', {
        keyCheck: 'stale',
        keyProof: 'kp',
        salt: 's',
        params: { alg: 'argon2id', t: 2, m: 19456, p: 1 },
        wrappedKey: 'wk',
        authKey: 'ak',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('stores a bcrypt hash of the auth key, never the key itself', async () => {
    const db = makeDb();
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValueOnce(updateReturning([{ userId: 'u1' }], sets));
    const service = new E2eBackupService(db as never);

    await service.setPasscode('u1', {
      keyCheck: 'kc',
      keyProof: 'kp',
      salt: 's',
      params: { alg: 'argon2id', t: 2, m: 19456, p: 1 },
      wrappedKey: 'wk',
      authKey: 'secret-auth',
    });
    const stored = sets[0].passcodeAuthHash as string;
    expect(stored).not.toBe('secret-auth');
    await expect(bcrypt.compare('secret-auth', stored)).resolves.toBe(true);
    expect(sets[0]).toMatchObject({ failedAttempts: 0, lockedUntil: null });
  });

  it('stores the proof hash, never the proof itself', async () => {
    const db = makeDb();
    const sets: Record<string, unknown>[] = [];
    db.update.mockReturnValueOnce(updateReturning([{ userId: 'u1' }], sets));
    const service = new E2eBackupService(db as never);

    await service.setPasscode('u1', {
      keyCheck: 'kc',
      keyProof: 'secret-proof',
      salt: 's',
      params: { alg: 'argon2id', t: 2, m: 19456, p: 1 },
      wrappedKey: 'wk',
      authKey: 'ak',
    });
    expect(sets[0].keyProofHash).toBe(hashKeyProof('secret-proof'));
    expect(sets[0].keyProofHash).not.toBe('secret-proof');
  });

  it('409s a caller who knows the public keyCheck but not the proof', async () => {
    // The guarded UPDATE matches nothing when the proof hash differs.
    const db = makeDb();
    db.update.mockReturnValueOnce(updateReturning([]));
    const service = new E2eBackupService(db as never);

    const err = await service
      .setPasscode('u1', {
        keyCheck: 'kc',
        keyProof: 'forged',
        salt: 's',
        params: { alg: 'argon2id', t: 2, m: 19456, p: 1 },
        wrappedKey: 'attacker-wk',
        authKey: 'attacker-ak',
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'E2E_BACKUP_KEY_MISMATCH',
    });
  });
});

describe('E2eBackupService.init', () => {
  it('stores keyCheck and the proof hash, never the raw proof', async () => {
    const db = makeDb();
    const values: Record<string, unknown>[] = [];
    db.insert.mockReturnValueOnce({
      values: (v: Record<string, unknown>) => {
        values.push(v);
        return {
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([{ userId: 'u1' }]),
          }),
        };
      },
    });
    db.select.mockReturnValueOnce(limitQuery([{ keyCheck: 'kc' }]));
    const service = new E2eBackupService(db as never);

    const res = await service.init('u1', 'kc', 'secret-proof');

    expect(values[0]).toEqual({
      userId: 'u1',
      keyCheck: 'kc',
      keyProofHash: hashKeyProof('secret-proof'),
    });
    expect(res).toMatchObject({ created: true, keyCheck: 'kc' });
    // getStatus must never leak the hash
    expect(res).not.toHaveProperty('keyProofHash');
  });
});

describe('hashKeyProof', () => {
  it('is deterministic hex sha256', () => {
    expect(hashKeyProof('x')).toBe(hashKeyProof('x'));
    expect(hashKeyProof('x')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKeyProof('x')).not.toBe(hashKeyProof('y'));
  });
});

describe('E2eBackupService.approve', () => {
  it('409s when the request is no longer pending', async () => {
    const db = makeDb();
    db.select.mockReturnValueOnce(limitQuery([{ id: 'd-old' }])); // own device
    db.update.mockReturnValueOnce(updateReturning([]));
    const service = new E2eBackupService(db as never);

    const err = await service
      .approve('u1', 'r1', {
        approverDeviceId: 'd-old',
        header: { v: 1, dh: 'dh', pn: 0, n: 0 },
        wrappedKey: 'wk',
      })
      .catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'E2E_REQUEST_NOT_PENDING',
    });
  });

  it("404s when the approver isn't one of the caller's active devices", async () => {
    const db = makeDb();
    db.select.mockReturnValueOnce(limitQuery([]));
    const service = new E2eBackupService(db as never);

    await expect(
      service.approve('u1', 'r1', {
        approverDeviceId: 'someone-elses',
        header: { v: 1, dh: 'dh', pn: 0, n: 0 },
        wrappedKey: 'wk',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(db.update).not.toHaveBeenCalled();
  });
});
