import { BadRequestException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { AdminService } from './admin.service';
import { users } from '../db/schema/users.schema';
import { userLoginDevices } from '../db/schema/login-devices.schema';

const actor = { id: 'admin-1', role: 'admin' as const };

type Update = { table: unknown; values: Record<string, unknown> };

/** A transaction stand-in that records every `update(...).set(values)`. */
function makeTx() {
  const updates: Update[] = [];
  const chain = (table: unknown) => {
    const c: Record<string, unknown> = {};
    c.set = (values: Record<string, unknown>) => {
      updates.push({ table, values });
      return c;
    };
    for (const m of ['where', 'returning', 'limit', 'for']) c[m] = () => c;
    c.then = (resolve: (v: unknown[]) => unknown) =>
      Promise.resolve([]).then(resolve);
    return c;
  };
  return {
    tx: {
      update: (table: unknown) => chain(table),
      select: () => chain(users),
      delete: (table: unknown) => chain(table),
    },
    updates,
  };
}

function makeService(
  db: Record<string, unknown> = {},
  pubsub: Record<string, unknown> = {},
) {
  return new AdminService(
    { transaction: jest.fn(), ...db } as never,
    { publish: jest.fn(), ...pubsub } as never,
  );
}

describe('AdminService.suspendAccount', () => {
  it('records the reason and ends every session in one unit of work', async () => {
    const { tx, updates } = makeTx();
    const service = makeService();

    await service.suspendAccount(tx as never, 'u1', 'Reported: Scam', actor.id);

    const userUpdate = updates.find((u) => u.table === users);
    expect(userUpdate?.values).toMatchObject({
      status: 'suspended',
      statusReason: 'Reported: Scam',
      suspendedById: actor.id,
    });
    expect(userUpdate?.values.suspendedAt).toBeInstanceOf(Date);
    // The bearer cutoff is what kills a sid-less legacy token.
    expect(userUpdate?.values.tokensValidAfter).toBeInstanceOf(Date);

    const deviceUpdate = updates.find((u) => u.table === userLoginDevices);
    expect(deviceUpdate?.values.revokedAt).toBeInstanceOf(Date);
  });
});

describe('AdminService.updateUser suspension boundary', () => {
  it('refuses a suspension with no reason and touches nothing', async () => {
    const transaction = jest.fn();
    const service = makeService({ transaction });

    await expect(
      service.updateUser('u1', { status: 'suspended' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only reason as missing', async () => {
    const transaction = jest.fn();
    const service = makeService({ transaction });

    await expect(
      service.updateUser(
        'u1',
        { status: 'suspended', statusReason: '   ' },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('AdminService.announceSuspension', () => {
  it('publishes the socket-close signal for that account', async () => {
    const publish = jest.fn().mockResolvedValue(1);
    const service = makeService({}, { publish });

    await service.announceSuspension('u1');

    expect(publish).toHaveBeenCalledWith({
      targetUserId: 'u1',
      type: 'session_ended',
      payload: { reason: 'Account suspended' },
    });
  });

  it('never fails a completed suspension because Redis is down', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('no redis'));
    const service = makeService({}, { publish });

    await expect(service.announceSuspension('u1')).resolves.toBeUndefined();
  });
});

/**
 * `listUsers` filters. The premium/verified predicates are raw SQL, so the only
 * way to catch a broken one is to compile the WHERE the query actually builds.
 */
describe('AdminService.listUsers filters', () => {
  const dialect = new PgDialect();

  /** Records the WHERE of the rows query and the count query. */
  function makeListDb() {
    const wheres: unknown[] = [];
    const chain = (rows: unknown[]) => {
      const c: Record<string, unknown> = {};
      for (const m of ['from', 'innerJoin', 'leftJoin', 'groupBy'])
        c[m] = () => c;
      c.where = (arg: unknown) => {
        wheres.push(arg);
        return c;
      };
      for (const m of ['orderBy', 'limit', 'offset']) c[m] = () => c;
      c.then = (resolve: (v: unknown[]) => unknown) =>
        Promise.resolve(rows).then(resolve);
      return c;
    };
    let call = 0;
    return {
      wheres,
      db: {
        select: jest.fn(() => chain(call++ === 0 ? [] : [{ value: 0 }])),
        selectDistinct: jest.fn(() => chain([])),
      },
    };
  }

  const compiled = (wheres: unknown[]) =>
    wheres
      .map((where) => dialect.sqlToQuery(where as never))
      .reduce(
        (acc, q) => ({
          sql: `${acc.sql} ${q.sql}`,
          params: [...acc.params, ...q.params],
        }),
        { sql: '', params: [] as unknown[] },
      );

  it('filters premium as an active-subscription EXISTS', async () => {
    const { db, wheres } = makeListDb();
    const service = makeService(db);

    await service.listUsers({ accountType: 'premium' });

    const { sql } = compiled(wheres);
    expect(sql).toContain('exists');
    expect(sql).toContain('user_subscriptions');
    expect(sql).toContain('superseded_at');
  });

  it('filters normal as NOT EXISTS, so the two are complementary', async () => {
    const { db, wheres } = makeListDb();
    const service = makeService(db);

    await service.listUsers({ accountType: 'normal' });

    expect(compiled(wheres).sql).toMatch(/not\s*\(?\s*exists|not exists/);
  });

  it('filters unverified as neither timestamp set', async () => {
    const { db, wheres } = makeListDb();
    const service = makeService(db);

    await service.listUsers({ verified: false });

    const { sql } = compiled(wheres);
    expect(sql).toContain('phone_verified_at');
    expect(sql).toContain('email_verified_at');
    expect(sql).toMatch(/not/);
  });

  it('searching matches name, username, email or phone', async () => {
    const { db, wheres } = makeListDb();
    const service = makeService(db);

    await service.listUsers({ q: 'xiaomi' });

    const { sql, params } = compiled(wheres);
    expect(sql).toContain('ilike');
    expect(params).toContain('%xiaomi%');
  });

  it('defaults to every state except deleted', async () => {
    const { db, wheres } = makeListDb();
    const service = makeService(db);

    await service.listUsers({});

    const { sql, params } = compiled(wheres);
    expect(sql).toContain('"status"');
    expect(params).toContain('deleted');
  });
});
