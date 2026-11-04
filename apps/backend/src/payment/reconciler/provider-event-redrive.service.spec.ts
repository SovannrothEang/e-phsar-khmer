import { Logger } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE } from '../outbox/payment-outbox-events';
import {
  MAX_PROVIDER_EVENT_REDRIVES,
  PROVIDER_EVENT_REDRIVE_INTERVAL_MS,
  PROVIDER_EVENT_RETENTION_DAYS,
  STALE_PROVIDER_EVENT_MS,
  ProviderEventRedrive,
} from './provider-event-redrive.service';

const MINUTE = 60_000;
const NOW = 1_800_000_000_000;

/** Drizzle chain that resolves `rows` at `.limit()`. */
function selectChain(rows: unknown[], sink?: { where: unknown[] }) {
  const self: Record<string, unknown> = {};
  self.from = jest.fn(() => self);
  self.where = jest.fn((condition: unknown) => {
    sink?.where.push(condition);
    return self;
  });
  self.orderBy = jest.fn(() => self);
  self.limit = jest.fn(() => Promise.resolve(rows));
  return self;
}

function deleteChain(rows: unknown[]) {
  const returning = jest.fn().mockResolvedValue(rows);
  const where = jest.fn(() => ({ returning }));
  return { where, returning };
}

interface StaleEvent {
  id: string;
}

interface PriorRedrive {
  eventId: string;
  status: string;
  dedupeKey: string;
}

/** `payment-event-redrive:<eventId>:<attempt>`, the shape the service writes. */
const redriveKey = (eventId: string, attempt: number) =>
  `payment-event-redrive:${eventId}:${attempt}`;

function build(opts: { deleteBatches?: unknown[][] } = {}) {
  const deleteBatches = [...(opts.deleteBatches ?? [[]])];
  const db = {
    select: jest.fn(),
    delete: jest.fn(() => deleteChain(deleteBatches.shift() ?? [])),
  };
  const outbox = {
    enqueue: jest
      .fn()
      .mockImplementation((_executor: unknown, event: unknown) =>
        Promise.resolve({ id: 'outbox-1', ...(event as object) }),
      ),
    wakeupAfterCommit: jest.fn(),
  };
  const redrive = new ProviderEventRedrive(db as never, outbox as never);

  /** Queues the two selects one sweep reads (the second only when stale rows exist). */
  function respond(stale: StaleEvent[], prior: PriorRedrive[] = []) {
    db.select.mockReturnValueOnce(selectChain(stale));
    if (stale.length > 0) db.select.mockReturnValueOnce(selectChain(prior));
  }

  return { redrive, db, outbox, respond, deleteBatches };
}

describe('ProviderEventRedrive stale-event re-drive', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('re-enqueues a stale received event through the durable outbox path', async () => {
    const { redrive, outbox, respond } = build();
    respond([{ id: 'e1' }]);

    const result = await redrive.sweep(NOW);

    expect(result).toMatchObject({ redriven: 1, exhausted: 0 });
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: PAYMENT_PROVIDER_EVENT_OUTBOX_EVENT_TYPE,
        aggregateType: 'payment_provider_event',
        aggregateId: 'e1',
        payload: { paymentProviderEventId: 'e1', redriveAttempt: 1 },
        dedupeKey: redriveKey('e1', 1),
      }),
    );
    expect(outbox.wakeupAfterCommit).toHaveBeenCalledTimes(1);
  });

  it('looks only at received rows older than the two-minute job budget', async () => {
    const { redrive, db } = build();
    const staleSink = { where: [] as unknown[] };
    db.select.mockReturnValueOnce(selectChain([], staleSink));

    await redrive.sweep(NOW);

    const rendered = new PgDialect().sqlToQuery(staleSink.where[0] as SQL);
    expect(rendered.sql).toContain('"received_at" <');
    expect(rendered.sql).toContain('"status" =');
    // `and()` inlines equality first, so find the timestamp among the params
    // rather than assuming its position.
    const instants = rendered.params
      .map((param) => {
        if (param instanceof Date) return param.getTime();
        if (typeof param === 'number') return param;
        return Date.parse(String(param));
      })
      .filter((value) => Number.isFinite(value));
    expect(instants).toContain(NOW - STALE_PROVIDER_EVENT_MS);
  });

  it('does nothing for a recent event, because the query never selects it', async () => {
    const { redrive, db, outbox, respond } = build();
    respond([]);

    const result = await redrive.sweep(NOW);

    expect(result).toMatchObject({ redriven: 0, exhausted: 0 });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(outbox.wakeupAfterCommit).not.toHaveBeenCalled();
  });

  it('runs the re-drive sweep at most once a minute', async () => {
    const { redrive, db, outbox, respond } = build();
    respond([{ id: 'e1' }]);
    await redrive.sweep(NOW);

    // Inside the minute: neither the stale read nor an enqueue may happen.
    const second = await redrive.sweep(
      NOW + PROVIDER_EVENT_REDRIVE_INTERVAL_MS - 1,
    );

    expect(second).toMatchObject({ redriven: 0, exhausted: 0 });
    expect(db.select).toHaveBeenCalledTimes(2); // one sweep's stale + prior reads
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);

    respond([{ id: 'e2' }]);
    const third = await redrive.sweep(NOW + PROVIDER_EVENT_REDRIVE_INTERVAL_MS);

    expect(third).toMatchObject({ redriven: 1 });
    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
  });

  it('advances the attempt number from the previous re-drive row', async () => {
    const { redrive, outbox, respond } = build();
    respond(
      [{ id: 'e1' }],
      [{ eventId: 'e1', status: 'published', dedupeKey: redriveKey('e1', 1) }],
    );

    await redrive.sweep(NOW);

    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: { paymentProviderEventId: 'e1', redriveAttempt: 2 },
        dedupeKey: redriveKey('e1', 2),
      }),
    );
  });

  it('waits for a re-drive row that is still queued instead of adding another', async () => {
    const { redrive, outbox, respond } = build();
    respond(
      [{ id: 'e1' }],
      [{ eventId: 'e1', status: 'pending', dedupeKey: redriveKey('e1', 1) }],
    );

    const result = await redrive.sweep(NOW);

    expect(result).toMatchObject({ redriven: 0, exhausted: 0 });
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('gives up after three re-drives and logs it once', async () => {
    const error = jest.spyOn(Logger.prototype, 'error');
    const { redrive, outbox, respond } = build();
    const exhausted: PriorRedrive[] = [
      {
        eventId: 'e1',
        status: 'published',
        dedupeKey: redriveKey('e1', MAX_PROVIDER_EVENT_REDRIVES),
      },
    ];

    respond([{ id: 'e1' }], exhausted);
    expect(await redrive.sweep(NOW)).toMatchObject({
      redriven: 0,
      exhausted: 1,
    });

    respond([{ id: 'e1' }], exhausted);
    expect(await redrive.sweep(NOW + MINUTE)).toMatchObject({ exhausted: 1 });

    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(
      error.mock.calls.filter((call) => String(call[0]).includes('e1')),
    ).toHaveLength(1);
  });
});

describe('ProviderEventRedrive retention', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes rows older than the 30-day dedupe window', async () => {
    const { redrive, db, respond } = build({
      deleteBatches: [[{ id: 'old-1' }]],
    });
    respond([]);

    const result = await redrive.sweep(NOW);

    expect(result.purged).toBe(1);
    const deleteQuery = db.delete.mock.results[0].value as {
      where: jest.Mock;
    };
    const deleteWhere = (
      deleteQuery.where.mock.calls as unknown[][]
    )[0]?.[0] as SQL;
    const rendered = new PgDialect().sqlToQuery(deleteWhere);
    expect(rendered.sql).toContain('"received_at" <');
    expect(rendered.sql).toContain('make_interval(days =>');
    expect(rendered.sql).toContain('for update skip locked');
    expect(rendered.params).toContain(PROVIDER_EVENT_RETENTION_DAYS);
  });

  it('batches until a short delete, so a first backlog cannot run forever', async () => {
    const { redrive, db, respond } = build({
      deleteBatches: [new Array(500).fill({ id: 'x' }), [{ id: 'y' }]],
    });
    respond([]);

    const result = await redrive.sweep(NOW);

    expect(result.purged).toBe(501);
    expect(db.delete).toHaveBeenCalledTimes(2);
  });

  it('runs retention hourly, not on every re-drive cadence', async () => {
    const { redrive, db, respond } = build();

    respond([]);
    await redrive.sweep(NOW);
    expect(db.delete).toHaveBeenCalledTimes(1);

    respond([]);
    await redrive.sweep(NOW + MINUTE);
    expect(db.delete).toHaveBeenCalledTimes(1);

    respond([]);
    await redrive.sweep(NOW + 60 * MINUTE);
    expect(db.delete).toHaveBeenCalledTimes(2);
  });

  it('keeps re-driving when the retention delete fails', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { redrive, db, outbox, respond } = build();
    db.delete.mockReturnValueOnce({
      where: jest.fn(() => ({
        returning: jest.fn().mockRejectedValue(new Error('db down')),
      })),
    });
    respond([{ id: 'e1' }]);

    const result = await redrive.sweep(NOW);

    expect(result).toMatchObject({ purged: 0, redriven: 1 });
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});
