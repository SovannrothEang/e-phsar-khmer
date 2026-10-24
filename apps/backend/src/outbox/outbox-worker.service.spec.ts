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
      'outbox.workerConcurrency': 2,
      'outbox.pollIntervalMs': 60_000,
    });

    worker.onApplicationBootstrap();
    // Startup wakeup broadcasts to both workers.
    await jest.advanceTimersByTimeAsync(0);
    expect(dispatchDue).toHaveBeenCalledTimes(2);

    // A producer's wakeup drains again, 60s before the fallback would fire.
    worker.wakeup();
    await jest.advanceTimersByTimeAsync(0);
    expect(dispatchDue).toHaveBeenCalledTimes(4);

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

  it('costs one claim per fallback tick regardless of pool size, and retains no waiters', async () => {
    jest.useFakeTimers();
    const { dispatcher, dispatchDue } = makeDispatcher([]);
    const worker = makeWorker(dispatcher, {
      'outbox.workerEnabled': true,
      'outbox.workerConcurrency': 3,
      'outbox.pollIntervalMs': 50,
    });

    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    // The startup wakeup fans out to all workers. Subsequent idle fallback
    // should perform one claim per pool interval, not one claim per worker.
    expect(dispatchDue).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(150);
    expect(dispatchDue).toHaveBeenCalledTimes(6);

    const signal = (
      worker as unknown as {
        wakeupSignal: { waiters: Set<unknown> };
      }
    ).wakeupSignal;
    // Every tick wakes one worker that re-parks afterwards, so the waiter set
    // never grows past the pool size.
    expect(signal.waiters.size).toBe(3);

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

    resolvers.splice(0).forEach((resolve) => resolve());
    await flush();
    // A wakeup buffered while all workers were busy must trigger a follow-up
    // drain once capacity is available.
    expect(dispatchDue).toHaveBeenCalledTimes(4);
    resolvers.splice(0).forEach((resolve) => resolve());
    await flush();
    await worker.onModuleDestroy();
  });

  it('uses a fallback claim to wake idle peers when backlog exists', async () => {
    jest.useFakeTimers();
    const found = [outcome('published', 'evt-found')];
    const { dispatcher, dispatchDue } = makeDispatcher(
      [],
      [],
      [],
      found,
      [],
      [],
    );
    const worker = makeWorker(dispatcher, {
      'outbox.workerEnabled': true,
      'outbox.workerConcurrency': 3,
      'outbox.pollIntervalMs': 50,
      'outbox.batchSize': 2,
    });

    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(dispatchDue).toHaveBeenCalledTimes(3); // startup fan-out
    expect(
      (worker as unknown as { wakeupSignal: { waiters: Set<unknown> } })
        .wakeupSignal.waiters.size,
    ).toBe(3);

    await jest.advanceTimersByTimeAsync(50);
    await jest.advanceTimersByTimeAsync(0);
    // The fallback worker finds due work and broadcasts to its two idle
    // peers, which each make a concurrent claim.
    expect(dispatchDue).toHaveBeenCalledTimes(6);

    await worker.onModuleDestroy();
  });

  it('keeps polling while one worker is stuck in a hung handler', async () => {
    jest.useFakeTimers();
    let calls = 0;
    const dispatchDue = jest.fn(async (): Promise<DispatchOutcome[]> => {
      calls += 1;
      // The very first claim never settles: that worker is gone for good.
      if (calls === 1) await new Promise<void>(() => undefined);
      return [];
    });
    const worker = makeWorker(
      { dispatchDue },
      {
        'outbox.workerEnabled': true,
        'outbox.workerConcurrency': 2,
        'outbox.pollIntervalMs': 50,
      },
    );

    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(dispatchDue).toHaveBeenCalledTimes(2); // startup fan-out

    // The fallback keeps ticking through the surviving worker.
    await jest.advanceTimersByTimeAsync(150);
    expect(dispatchDue).toHaveBeenCalledTimes(5);

    // Shutdown gives the hung worker its grace period, then gives up on it.
    const destroyed = worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(10_000);
    await destroyed;
  });

  it('stops the fallback timer on shutdown', async () => {
    jest.useFakeTimers();
    const { dispatcher, dispatchDue } = makeDispatcher([], []);
    const worker = makeWorker(dispatcher, {
      'outbox.workerEnabled': true,
      'outbox.workerConcurrency': 2,
      'outbox.pollIntervalMs': 50,
    });

    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(500);

    expect(dispatchDue).toHaveBeenCalledTimes(2);
  });

  it('releases parked workers on shutdown without starting another drain', async () => {
    jest.useFakeTimers();
    const { dispatcher, dispatchDue } = makeDispatcher([], [], []);
    const worker = makeWorker(dispatcher, {
      'outbox.workerEnabled': true,
      'outbox.workerConcurrency': 3,
      'outbox.pollIntervalMs': 60_000,
    });

    worker.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(dispatchDue).toHaveBeenCalledTimes(3);

    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(0);

    expect(dispatchDue).toHaveBeenCalledTimes(3);
    expect(
      (worker as unknown as { wakeupSignal: { waiters: Set<unknown> } })
        .wakeupSignal.waiters.size,
    ).toBe(0);
  });
});
