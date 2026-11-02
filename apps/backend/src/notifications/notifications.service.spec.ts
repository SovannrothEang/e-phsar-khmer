import { PgDialect } from 'drizzle-orm/pg-core';
import { NotificationsService } from './notifications.service';

interface FakeDb {
  transaction: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  _insertValues: Record<string, unknown>[];
}

function makeDb(): FakeDb {
  const insertValues: Record<string, unknown>[] = [];
  const db: FakeDb = {
    // The transaction hands the callback this same fake as `tx`, so insert
    // assertions hold whichever of `db`/`tx` the service writes through.
    transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => cb(db)),
    select: jest.fn(),
    insert: jest.fn().mockImplementation(() => ({
      values: (values: Record<string, unknown>) => {
        insertValues.push(values);
        return { onConflictDoNothing: () => Promise.resolve([]) };
      },
    })),
    update: jest.fn(),
    delete: jest.fn(),
    _insertValues: insertValues,
  };
  return db;
}

function makeOutbox(
  overrides: Partial<Record<string, jest.Mock>> = {},
): Record<string, jest.Mock> {
  return {
    enqueue: jest
      .fn()
      .mockResolvedValue({ id: 'evt-1', dedupeKey: 'dedupe-1' }),
    wakeupAfterCommit: jest.fn(),
    ...overrides,
  };
}

function makeService(
  db: ReturnType<typeof makeDb>,
  channels: Record<string, jest.Mock>[] = [],
  outbox: Record<string, jest.Mock> = makeOutbox(),
) {
  return new NotificationsService(
    db as never,
    channels as never,
    outbox as never,
  );
}

/** .delete().where(<captured>).returning(…) → rows */
function deleteQuery(capture: { where?: unknown }, rows: unknown[]) {
  return {
    where: (where: unknown) => {
      capture.where = where;
      return { returning: () => Promise.resolve(rows) };
    },
  };
}

const compileWhere = (where: unknown) =>
  new PgDialect().sqlToQuery(where as never);

describe('NotificationsService deletes', () => {
  let db: ReturnType<typeof makeDb>;
  let service: NotificationsService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  describe('remove', () => {
    it('scopes the DELETE to the owner as well as the id', async () => {
      const capture: { where?: unknown } = {};
      db.delete.mockReturnValue(deleteQuery(capture, [{ id: 'n1' }]));

      await expect(service.remove('u1', 'n1')).resolves.toEqual({ deleted: 1 });

      // Both predicates have to be in the WHERE: an id-only delete would let
      // any signed-in user delete any notification by guessing a UUID.
      const { sql, params } = compileWhere(capture.where);
      expect(sql).toContain('id');
      expect(sql).toContain('user_id');
      expect(params).toContain('n1');
      expect(params).toContain('u1');
    });

    it('reports 0 — not an error — for a row that is not this user’s', async () => {
      db.delete.mockReturnValue(deleteQuery({}, []));
      await expect(service.remove('u1', 'someone-elses-id')).resolves.toEqual({
        deleted: 0,
      });
    });
  });

  describe('removeAll', () => {
    it('deletes only this user’s rows and counts them', async () => {
      const capture: { where?: unknown } = {};
      db.delete.mockReturnValue(
        deleteQuery(capture, [{ id: 'a' }, { id: 'b' }]),
      );

      await expect(service.removeAll('u1')).resolves.toEqual({ deleted: 2 });

      const { sql, params } = compileWhere(capture.where);
      expect(sql).toContain('user_id');
      // Scoped by owner and by nothing else — no is_read predicate, so read
      // rows go too.
      expect(sql).not.toContain('is_read');
      expect(params).toEqual(['u1']);
    });
  });
});

describe('NotificationsService.notify — SMS enqueue', () => {
  const basePayload = {
    userId: 'u1',
    type: 'payment.succeeded',
    title: 'Payment successful',
    body: 'Your payment has been received.',
  };

  it('fires every in-app/realtime channel regardless of sendSms', async () => {
    const db = makeDb();
    const channel = { send: jest.fn().mockResolvedValue(undefined) };
    const service = makeService(db, [channel]);

    await service.notify(basePayload);

    expect(channel.send).toHaveBeenCalledWith(basePayload);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('enqueues exactly one outbox event and one queued delivery row when sendSms is true', async () => {
    const db = makeDb();
    const outbox = makeOutbox();
    const service = makeService(db, [], outbox);

    await service.notify({
      ...basePayload,
      data: { sendSms: true, paymentTransactionId: 'tx-1' },
    });

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    const [, enqueuedEvent] = outbox.enqueue.mock.calls[0] as [
      unknown,
      {
        eventType: string;
        dedupeKey: string;
        payload: Record<string, unknown>;
      },
    ];
    expect(enqueuedEvent.eventType).toBe('notification.sms.requested');
    expect(enqueuedEvent.dedupeKey).toContain('u1');
    expect(enqueuedEvent.dedupeKey).toContain('payment.succeeded');
    // No message text leaks into the enqueue call outside the payload the
    // handler is explicitly allowed to hold until delivery.
    expect(enqueuedEvent.payload).toEqual(
      expect.objectContaining({
        userId: 'u1',
        notificationType: 'payment.succeeded',
      }),
    );

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db._insertValues[0]).toEqual(
      expect.objectContaining({
        userId: 'u1',
        notificationType: 'payment.succeeded',
        status: 'queued',
        outboxEventId: 'evt-1',
      }),
    );
    expect(outbox.wakeupAfterCommit).toHaveBeenCalledTimes(1);
  });

  it('produces the same dedupe key for two calls with the same stable data', async () => {
    const db = makeDb();
    const outbox = makeOutbox();
    const service = makeService(db, [], outbox);

    const payload = {
      ...basePayload,
      data: { sendSms: true, paymentTransactionId: 'tx-1' },
    };
    await service.notify(payload);
    await service.notify(payload);

    const keys = outbox.enqueue.mock.calls.map(
      ([, event]: [unknown, { dedupeKey: string }]) => event.dedupeKey,
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it('never enqueues or writes a delivery row when sendSms is absent or false', async () => {
    const db = makeDb();
    const outbox = makeOutbox();
    const service = makeService(db, [], outbox);

    await service.notify(basePayload);
    await service.notify({ ...basePayload, data: { sendSms: false } });

    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('does not reject notify() when queuing the SMS fails, so the caller never re-writes the in-app row', async () => {
    const db = makeDb();
    const channel = { send: jest.fn().mockResolvedValue(undefined) };
    const outbox = makeOutbox({
      enqueue: jest.fn().mockRejectedValue(new Error('db down')),
    });
    const service = makeService(db, [channel], outbox);

    await expect(
      service.notify({ ...basePayload, data: { sendSms: true } }),
    ).resolves.toBeUndefined();
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it('queues the event and the audit row in one transaction', async () => {
    const db = makeDb();
    const outbox = makeOutbox();
    const service = makeService(db, [], outbox);

    await service.notify({ ...basePayload, data: { sendSms: true } });

    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});
