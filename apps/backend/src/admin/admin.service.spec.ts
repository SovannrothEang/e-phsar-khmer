import { BadRequestException } from '@nestjs/common';
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
