import { OutboxWorker } from './outbox-worker.service';
import type { DispatchOutcome } from './outbox.types';

function outcome(status: DispatchOutcome['status'], id: string) {
  return { eventId: id, eventType: 'test.event', status };
}

function makeDispatcher(...batches: DispatchOutcome[][]) {
  const dispatchDue = jest.fn<Promise<DispatchOutcome[]>, [number]>();
  batches.forEach((b) => dispatchDue.mockResolvedValueOnce(b));
  dispatchDue.mockResolvedValue([]);
  return { dispatcher: { dispatchDue }, dispatchDue };
}

function makeConfigService(values: Record<string, unknown> = {}) {
  return { get: jest.fn((key: string) => values[key]) };
}

function makeWorker(
  dispatcher: { dispatchDue: jest.Mock },
  values: Record<string, unknown> = {},
) {
  return new OutboxWorker(
    dispatcher as never,
    { instanceId: 'test-instance' } as never,
    makeConfigService(values) as never,
  );
}

/** Drains microtasks (and lets worker loops reach their next await) on real timers. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
  jest.useRealTimers();
});

describe('OutboxWorker.runOnce', () => {
  it('drains a batch and reports how many events it handled', async () => {
    const { dispatcher } = makeDispatcher([
      outcome('published', 'evt-1'),
      outcome('published', 'evt-2'),
    ]);

    await expect(makeWorker(dispatcher).runOnce()).resolves.toBe(2);
  });

  it('asks for the configured batch size', async () => {
    const { dispatcher, dispatchDue } = makeDispatcher([]);

    await makeWorker(dispatcher, { 'outbox.batchSize': 25 }).runOnce();

    expect(dispatchDue).toHaveBeenCalledWith(25);
  });

  it('defaults the batch size when nothing is configured', async () => {
    const { dispatcher, dispatchDue } = makeDispatcher([]);

    await makeWorker(dispatcher).runOnce();

    expect(dispatchDue).toHaveBeenCalledWith(10);
  });

  it('reports failures without throwing', async () => {
    const { dispatcher } = makeDispatcher([outcome('failed', 'evt-9')]);

    await expect(makeWorker(dispatcher).runOnce()).resolves.toBe(1);
  });
});

describe('OutboxWorker lifecycle', () => {
  it('does not start when the worker is disabled', async () => {
    const { dispatcher, dispatchDue } = makeDispatcher([]);
    const worker = makeWorker(dispatcher, { 'outbox.workerEnabled': false });

    worker.onApplicationBootstrap();
    await worker.onModuleDestroy();

    expect(dispatchDue).not.toHaveBeenCalled();
  });

  it('a wakeup triggers a dispatch without waiting for the poll interval', async () => {
    jest.useFakeTimers();
    const { dispatcher, dispatchDue } = makeDispatcher([]);
    const worker = makeWorker(dispatcher, {
      'outbox.workerEnabled': true,
      'outbox.workerConcurrency': 1,
      'outbox.pollIntervalMs': 60_000,
    });

    worker.onApplicationBootstrap();
    // Startup wakeup drains once.
    await jest.advanceTimersByTimeAsync(0);
    expect(dispatchDue).toHaveBeenCalledTimes(1);

    // A producer's wakeup drains again, 60s before the fallback would fire.
    worker.wakeup();
    await jest.advanceTimersByTimeAsync(0);
    expect(dispatchDue).toHaveBeenCalledTimes(2);

    await worker.onModuleDestroy();
  });

  it('polls via the fallback timeout when no wakeup arrives', async () => {
    jest.useFakeTimers();
    const { dispatcher, dispatchDue } = makeDispatcher([]);
    const worker = makeWorker(dispatcher, {
      'outbox.workerEnabled': true,
      'outbox.workerConcurrency': 1,
      'outbox.pollIntervalMs': 50,
    });

    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(dispatchDue).toHaveBeenCalledTimes(1);

    // No wakeup — the fallback timer is the only thing that can run it again.
    await jest.advanceTimersByTimeAsync(50);
    expect(dispatchDue).toHaveBeenCalledTimes(2);

    await worker.onModuleDestroy();
  });

  it('keeps draining after a tick throws', async () => {
    jest.useFakeTimers();
    const dispatchDue = jest
      .fn<Promise<DispatchOutcome[]>, [number]>()
      .mockRejectedValueOnce(new Error('database is down'))
      .mockResolvedValue([]);
    const worker = makeWorker(
      { dispatchDue },
      {
        'outbox.workerEnabled': true,
        'outbox.workerConcurrency': 1,
        'outbox.pollIntervalMs': 50,
      },
    );

    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(50);

    expect(dispatchDue).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
  });

  it('goes straight back for another batch when the last one came back full', async () => {
    jest.useFakeTimers();
    const full = Array.from({ length: 10 }, (_, i) =>
      outcome('published', `evt-${i}`),
    );
    const { dispatcher, dispatchDue } = makeDispatcher(full);
    const worker = makeWorker(dispatcher, {
      'outbox.workerEnabled': true,
      'outbox.workerConcurrency': 1,
      'outbox.pollIntervalMs': 60_000,
      'outbox.batchSize': 10,
    });

    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    // Full batch → immediate second dispatch, not a 60s wait.
    await jest.advanceTimersByTimeAsync(1);

    expect(dispatchDue).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
  });

  it('keeps the pool bounded: never more dispatches in flight than concurrency', async () => {
    let active = 0;
    let maxActive = 0;
    const resolvers: Array<() => void> = [];
    const dispatchDue = jest.fn(async (): Promise<DispatchOutcome[]> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => {
        resolvers.push(resolve);
      });
      active -= 1;
      return [];
    });

    const worker = makeWorker(
      { dispatchDue },
      {
        'outbox.workerEnabled': true,
        'outbox.workerConcurrency': 3,
        'outbox.pollIntervalMs': 60_000,
      },
    );

    worker.onApplicationBootstrap();
    await flush();
    expect(active).toBe(3);
    expect(maxActive).toBe(3);

    // Extra wakeups while every worker is busy must not spawn more dispatches.
    worker.wakeup();
    worker.wakeup();
    worker.wakeup();
    await flush();
    expect(active).toBe(3);
    expect(maxActive).toBe(3);

    resolvers.forEach((resolve) => resolve());
    await flush();
    await worker.onModuleDestroy();
  });
});
