import { ConfigService } from '@nestjs/config';
import { AdminSmsDeliveriesService } from './admin-sms-deliveries.service';

interface ChainCalls {
  limit: number | null;
  offset: number | null;
}

/**
 * Drizzle chains end in two different places: the page query awaits `.offset()`
 * and the count query awaits `.where()` directly. The mock is a thenable so
 * the count chain resolves, and `offset` returns the rows.
 */
function makeDb(rows: Record<string, unknown>[], total: number) {
  const calls: ChainCalls = { limit: null, offset: null };
  const selected: Record<string, unknown>[] = [];
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: (value: number) => {
      calls.limit = value;
      return chain;
    },
    offset: (value: number) => {
      calls.offset = value;
      return Promise.resolve(rows);
    },
    then: (resolve: (value: unknown) => void) => resolve([{ value: total }]),
  };
  const db = {
    select: jest.fn((columns: Record<string, unknown>) => {
      selected.push(columns);
      return chain;
    }),
  };
  return { db, calls, selected };
}

function makeService(db: unknown) {
  const config = new ConfigService({
    sms: {
      privateKey: 'pk_live_0123456789',
      secret: 'shh_0123456789',
    },
  });
  return new AdminSmsDeliveriesService(db as never, config);
}

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    userId: 'u1',
    notificationType: 'payment.succeeded',
    maskedPhone: '855•••678',
    status: 'failed',
    skipReason: null,
    providerStatus: 401,
    providerReply: 'Invalid Sender',
    attempts: 3,
    purpose: null,
    createdAt: new Date('2026-11-05T00:00:00Z'),
    ...overrides,
  };
}

describe('AdminSmsDeliveriesService.list', () => {
  it('pages the audit trail and never exposes a message body', async () => {
    const rows = [delivery(), delivery({ id: 'd2', status: 'sent' })];
    const { db, calls, selected } = makeDb(rows, 21);
    const service = makeService(db);

    const result = await service.list({
      page: 2,
      pageSize: 10,
      status: 'failed',
    });

    expect(calls.limit).toBe(10);
    expect(calls.offset).toBe(10);
    expect(result.meta).toMatchObject({
      page: 2,
      pageSize: 10,
      total: 21,
      hasMore: true,
      nextCursor: null,
    });
    expect(result.data).toHaveLength(2);
    // The table stores no message text, and the projection must not invent one
    // (a notification body can carry an OTP).
    expect(Object.keys(selected[0]).sort()).toEqual(
      [
        'attempts',
        'createdAt',
        'id',
        'maskedPhone',
        'notificationType',
        'providerReply',
        'providerStatus',
        'purpose',
        'skipReason',
        'status',
        'userId',
      ].sort(),
    );
  });

  it('redacts a configured credential echoed back in the provider reply', async () => {
    const { db } = makeDb(
      [
        delivery({
          providerReply:
            'bad request for private_key=pk_live_0123456789 secret=shh_0123456789',
        }),
        delivery({ id: 'd2', providerReply: null }),
      ],
      2,
    );
    const service = makeService(db);

    const result = await service.list({ page: 1, pageSize: 20 });

    expect(result.data[0].providerReply).toBe(
      'bad request for private_key=[redacted] secret=[redacted]',
    );
    expect(result.data[1].providerReply).toBeNull();
  });
});
