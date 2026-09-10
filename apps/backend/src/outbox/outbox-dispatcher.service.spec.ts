import { OutboxDispatcher } from './outbox-dispatcher.service';
import { OutboxRegistry } from './outbox-registry.service';
import type { OutboxEventRow } from '../db/schema/outbox.schema';
import type { HandlerOutcome, OutboxHandler } from './outbox.types';

const EVENT_TYPE = 'test.thing.happened';

function makeEvent(overrides: Partial<OutboxEventRow> = {}): OutboxEventRow {
  return {
    id: 'evt-1',
    eventType: EVENT_TYPE,
    aggregateType: 'thing',
    aggregateId: 'thing-1',
    dedupeKey: null,
    payload: { secret: 'shhh', keep: 'yes' },
    status: 'processing',
    attempts: 1,
    maxAttempts: 3,
    availableAt: new Date(),
    lockedAt: new Date(),
    lockedBy: 'test',
    lastError: null,
    publishedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeOutbox() {
  return {
    claimDue: jest.fn().mockResolvedValue([]),
    claimById: jest.fn().mockResolvedValue(undefined),
    markPublished: jest.fn().mockResolvedValue(undefined),
    markRetry: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
}

function makeConfigService(values: Record<string, number> = {}) {
  return {
    get: jest.fn((key: string) => values[key] ?? undefined),
  };
}

function makeHandler(
  outcome: HandlerOutcome | (() => Promise<HandlerOutcome>),
  extras: Partial<OutboxHandler> = {},
): OutboxHandler & { handle: jest.Mock } {
  const handle = jest.fn(
    typeof outcome === 'function' ? outcome : () => Promise.resolve(outcome),
  );
  return { eventType: EVENT_TYPE, handle, ...extras } as OutboxHandler & {
    handle: jest.Mock;
  };
}

function makeDispatcher(handler?: OutboxHandler, config = makeConfigService()) {
  const outbox = makeOutbox();
  const registry = new OutboxRegistry();
  if (handler) {
    registry.register(handler);
  }
  const dispatcher = new OutboxDispatcher(
    outbox as never,
    registry,
    config as never,
  );
  return { dispatcher, outbox, registry };
}

describe('OutboxDispatcher.dispatchById', () => {
  it('returns null without running a handler when the event cannot be claimed', async () => {
    const handler = makeHandler({ status: 'published' });
    const { dispatcher, outbox } = makeDispatcher(handler);
    outbox.claimById.mockResolvedValue(undefined);

    const outcome = await dispatcher.dispatchById('evt-1');

    expect(outcome).toBeNull();
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('marks the event published when the handler succeeds', async () => {
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler({ status: 'published' }),
    );
    outbox.claimById.mockResolvedValue(makeEvent());

    const outcome = await dispatcher.dispatchById('evt-1');

    expect(outcome).toEqual({
      eventId: 'evt-1',
      eventType: EVENT_TYPE,
      status: 'published',
    });
    expect(outbox.markPublished).toHaveBeenCalledWith('evt-1', undefined);
    expect(outbox.markRetry).not.toHaveBeenCalled();
  });
});

describe('OutboxDispatcher retry and abandonment', () => {
  it('schedules a backoff retry while the attempt budget holds', async () => {
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler({ status: 'retry', error: 'timed out' }),
      makeConfigService({
        'outbox.backoffBaseMs': 1000,
        'outbox.backoffFactor': 5,
        'outbox.backoffMaxMs': 900_000,
      }),
    );
    outbox.claimById.mockResolvedValue(makeEvent({ attempts: 2 }));

    const outcome = await dispatcher.dispatchById('evt-1');

    expect(outcome?.status).toBe('retry');
    expect(outbox.markRetry).toHaveBeenCalledWith('evt-1', 'timed out', 5000);
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('fails the event and tells the handler once the budget is spent', async () => {
    const onAbandoned = jest.fn().mockResolvedValue(undefined);
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler(
        { status: 'retry', error: 'still timing out' },
        {
          onAbandoned,
        },
      ),
    );
    outbox.claimById.mockResolvedValue(
      makeEvent({ attempts: 3, maxAttempts: 3 }),
    );

    const outcome = await dispatcher.dispatchById('evt-1');

    expect(outcome?.status).toBe('failed');
    expect(outbox.markFailed).toHaveBeenCalled();
    expect(outbox.markRetry).not.toHaveBeenCalled();
    expect(onAbandoned).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-1' }),
      'still timing out',
    );
  });

  it('does not call onAbandoned when the handler itself declared failure', async () => {
    const onAbandoned = jest.fn();
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler(
        { status: 'failed', error: 'bad recipient' },
        {
          onAbandoned,
        },
      ),
    );
    outbox.claimById.mockResolvedValue(makeEvent());

    await dispatcher.dispatchById('evt-1');

    expect(outbox.markFailed).toHaveBeenCalled();
    expect(onAbandoned).not.toHaveBeenCalled();
  });

  it('treats a thrown handler as retryable rather than losing the event', async () => {
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler(() => Promise.reject(new Error('kaboom'))),
    );
    outbox.claimById.mockResolvedValue(makeEvent({ attempts: 1 }));

    const outcome = await dispatcher.dispatchById('evt-1');

    expect(outcome?.status).toBe('retry');
    expect(outbox.markRetry).toHaveBeenCalledWith(
      'evt-1',
      'kaboom',
      expect.any(Number),
    );
  });

  it('keeps the event alive when no handler is registered yet', async () => {
    const { dispatcher, outbox } = makeDispatcher();
    outbox.claimById.mockResolvedValue(makeEvent({ attempts: 1 }));

    const outcome = await dispatcher.dispatchById('evt-1');

    expect(outcome?.status).toBe('retry');
    expect(outcome?.error).toMatch(/No handler registered/);
  });

  it('applies the handler’s redaction when the event reaches a terminal state', async () => {
    const redact = jest.fn((p: unknown) => ({
      ...(p as Record<string, unknown>),
      secret: null,
    }));
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler({ status: 'published' }, { redact }),
    );
    outbox.claimById.mockResolvedValue(makeEvent());

    await dispatcher.dispatchById('evt-1');

    expect(outbox.markPublished).toHaveBeenCalledWith('evt-1', {
      secret: null,
      keep: 'yes',
    });
  });

  it('leaves the payload intact on a retry, so the next attempt can still use it', async () => {
    const redact = jest.fn();
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler({ status: 'retry', error: 'later' }, { redact }),
    );
    outbox.claimById.mockResolvedValue(makeEvent({ attempts: 1 }));

    await dispatcher.dispatchById('evt-1');

    expect(outbox.markRetry).toHaveBeenCalledWith(
      'evt-1',
      'later',
      expect.any(Number),
    );
  });

  it('survives a throwing onAbandoned hook', async () => {
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler(
        { status: 'retry', error: 'gone' },
        {
          onAbandoned: jest.fn().mockRejectedValue(new Error('hook exploded')),
        },
      ),
    );
    outbox.claimById.mockResolvedValue(
      makeEvent({ attempts: 3, maxAttempts: 3 }),
    );

    await expect(dispatcher.dispatchById('evt-1')).resolves.toEqual(
      expect.objectContaining({ status: 'failed' }),
    );
  });
});

describe('OutboxDispatcher.dispatchDue', () => {
  it('runs every claimed event and reports one outcome each', async () => {
    const { dispatcher, outbox } = makeDispatcher(
      makeHandler({ status: 'published' }),
    );
    outbox.claimDue.mockResolvedValue([
      makeEvent({ id: 'evt-1' }),
      makeEvent({ id: 'evt-2' }),
    ]);

    const outcomes = await dispatcher.dispatchDue(10);

    expect(outbox.claimDue).toHaveBeenCalledWith(10);
    expect(outcomes.map((o) => o.eventId)).toEqual(['evt-1', 'evt-2']);
    expect(outbox.markPublished).toHaveBeenCalledTimes(2);
  });

  it('returns nothing when the outbox is empty', async () => {
    const { dispatcher } = makeDispatcher(makeHandler({ status: 'published' }));

    await expect(dispatcher.dispatchDue(10)).resolves.toEqual([]);
  });
});
