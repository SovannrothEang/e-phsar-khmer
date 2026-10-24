import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { DbExecutor } from '../../db/drizzle.provider';
import { diffDevices, lockE2eDeviceKeys } from './e2e-devices.util';

describe('diffDevices', () => {
  const expected = [
    { userId: 'peer', deviceId: 'p1' },
    { userId: 'peer', deviceId: 'p2' },
    { userId: 'me', deviceId: 'm2' },
  ];

  it('reports nothing when the sets match (order-insensitive)', () => {
    expect(diffDevices(expected, ['m2', 'p2', 'p1'])).toEqual({
      missing: [],
      stale: [],
    });
  });

  it('reports a newly added device as missing', () => {
    expect(diffDevices(expected, ['p1', 'm2'])).toEqual({
      missing: [{ userId: 'peer', deviceId: 'p2' }],
      stale: [],
    });
  });

  it('reports a revoked device as stale', () => {
    expect(diffDevices(expected, ['p1', 'p2', 'm2', 'gone'])).toEqual({
      missing: [],
      stale: ['gone'],
    });
  });

  it('reports both at once (device swapped)', () => {
    expect(diffDevices(expected, ['p1', 'old', 'm2'])).toEqual({
      missing: [{ userId: 'peer', deviceId: 'p2' }],
      stale: ['old'],
    });
  });
});

describe('lockE2eDeviceKeys', () => {
  it('locks the per-user device keys in ascending key order', async () => {
    const queries: SQL[] = [];
    const execute = jest.fn((query: SQL) => {
      queries.push(query);
      return Promise.resolve([]);
    });
    await lockE2eDeviceKeys({ execute } as unknown as DbExecutor, ['u2', 'u1']);

    // One statement, both participants: a send must hold the sender's and the
    // recipient's locks for its whole in-transaction re-read + insert.
    expect(execute).toHaveBeenCalledTimes(1);
    const { sql, params } = new PgDialect().sqlToQuery(queries[0]);
    // Sorted (input was u2 then u1) — the ordering every lock-taker shares,
    // which is what makes concurrent transactions deadlock-free.
    expect(params).toEqual(['e2e-devices:u1', 'e2e-devices:u2']);
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(key, 0))');
    expect(sql).toContain('order by 1');
  });
});
