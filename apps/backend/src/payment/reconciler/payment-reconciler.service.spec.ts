import { PaymentReconciler } from './payment-reconciler.service';
import { runExpireAttempt, runReconcileAttempt } from './run-reconcile-attempt';

// The Effect bridge is mocked at its Promise boundary — `effect` is ESM-only
// and Jest never needs to load it to test the sweep's own logic.
jest.mock('./run-reconcile-attempt', () => ({
  runReconcileAttempt: jest.fn(),
  runExpireAttempt: jest.fn(),
}));

const reconcileMock = runReconcileAttempt as unknown as jest.Mock;
const expireMock = runExpireAttempt as unknown as jest.Mock;

/** A drizzle-style query chain that resolves `rows` at `.limit()`. */
function chain(rows: unknown[]) {
  const self: Record<string, unknown> = {};
  for (const method of ['from', 'innerJoin', 'where', 'orderBy']) {
    self[method] = jest.fn(() => self);
  }
  self.limit = jest.fn(() => Promise.resolve(rows));
  return self;
}

const MINUTE = 60_000;

function build(opts: {
  stuck?: unknown[];
  expired?: unknown[];
  candidates?: unknown[];
  providers?: string[];
  activate?: jest.Mock;
}) {
  const db = {
    select: jest
      .fn()
      // In call order: purchases awaiting activation, expired webhook-only
      // attempts, then attempts to reconcile.
      .mockReturnValueOnce(chain(opts.stuck ?? []))
      .mockReturnValueOnce(chain(opts.expired ?? []))
      .mockReturnValueOnce(chain(opts.candidates ?? [])),
  };
  const outbox = { wakeupAfterCommit: jest.fn() };
  const activation = {
    activatePaidPurchase:
      opts.activate ?? jest.fn().mockResolvedValue({ status: 'activated' }),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'payment.reconcileProviders'
        ? (opts.providers ?? ['bakong'])
        : undefined,
    ),
  };
  const reconciler = new PaymentReconciler(
    db as never,
    {} as never,
    outbox as never,
    activation as never,
    config as never,
  );
  return { reconciler, db, outbox, activation };
}

const attempt = (id: string, ageMs: number) => ({
  id,
  createdAt: new Date(Date.now() - ageMs),
});

describe('PaymentReconciler.runOnce', () => {
  beforeEach(() => {
    reconcileMock.mockReset();
    expireMock.mockReset();
  });

  it('settles an unresolved attempt and wakes the outbox so activation follows', async () => {
    reconcileMock.mockResolvedValue('succeeded');
    const { reconciler, outbox } = build({
      candidates: [attempt('a1', 2 * MINUTE)],
    });

    const summary = await reconciler.runOnce(1);

    expect(summary).toMatchObject({ checked: 1, settled: 1, errors: 0 });
    expect(outbox.wakeupAfterCommit).toHaveBeenCalledTimes(1);
  });

  it('counts an attempt abandoned after the checkout expired unpaid', async () => {
    reconcileMock.mockResolvedValue('abandoned');
    const { reconciler, outbox } = build({
      candidates: [attempt('a1', 20 * MINUTE)],
    });

    const summary = await reconciler.runOnce(1);

    expect(summary).toMatchObject({ abandoned: 1, settled: 0 });
    expect(outbox.wakeupAfterCommit).not.toHaveBeenCalled();
  });

  it('does not count a lost race (reported as skipped) as an error', async () => {
    reconcileMock.mockResolvedValue('skipped');
    const { reconciler } = build({ candidates: [attempt('a1', MINUTE)] });

    const summary = await reconciler.runOnce(1);

    expect(summary).toMatchObject({ checked: 1, settled: 0, errors: 0 });
  });

  it('survives a gateway failure and keeps going with the next attempt', async () => {
    reconcileMock
      .mockResolvedValueOnce('error')
      .mockResolvedValueOnce('succeeded');
    const { reconciler } = build({
      candidates: [attempt('a1', MINUTE), attempt('a2', 2 * MINUTE)],
    });

    const summary = await reconciler.runOnce(1);

    expect(summary).toMatchObject({ checked: 2, settled: 1, errors: 1 });
  });

  it('checks old attempts only on every Nth tick', async () => {
    reconcileMock.mockResolvedValue('still_pending');
    const old = attempt('old', 3 * 60 * MINUTE);

    const offTick = build({ candidates: [old] });
    expect((await offTick.reconciler.runOnce(1)).checked).toBe(0);

    const onTick = build({ candidates: [old] });
    expect((await onTick.reconciler.runOnce(20)).checked).toBe(1);
  });

  it('activates a purchase whose payment already settled, with no provider call', async () => {
    const { reconciler, activation } = build({
      stuck: [
        {
          purchaseId: 'p1',
          paymentTransactionId: 't1',
          customerId: 'u1',
          amount: '0.20',
          currency: 'USD',
        },
      ],
    });

    const summary = await reconciler.runOnce(1);

    expect(summary.activated).toBe(1);
    expect(activation.activatePaidPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseId: 'p1', paymentTransactionId: 't1' }),
    );
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('does not count an already-paid purchase, and survives an activation error', async () => {
    const activate = jest
      .fn()
      .mockResolvedValueOnce({ status: 'already_paid' })
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ status: 'activated' });
    const row = (id: string) => ({
      purchaseId: id,
      paymentTransactionId: `t-${id}`,
      customerId: 'u1',
      amount: '0.20',
      currency: 'USD',
    });
    const { reconciler } = build({
      stuck: [row('p1'), row('p2'), row('p3')],
      activate,
    });

    const summary = await reconciler.runOnce(1);

    expect(activate).toHaveBeenCalledTimes(3);
    expect(summary.activated).toBe(1);
  });

  it('still finishes activation when no provider is configured to poll', async () => {
    const { reconciler, db, activation } = build({
      stuck: [
        {
          purchaseId: 'p1',
          paymentTransactionId: 't1',
          customerId: 'u1',
          amount: '0.20',
          currency: 'USD',
        },
      ],
      providers: [],
    });

    const summary = await reconciler.runOnce(1);

    expect(activation.activatePaidPurchase).toHaveBeenCalledTimes(1);
    expect(summary.checked).toBe(0);
    // activation + expiry only — the candidates query is skipped.
    expect(db.select).toHaveBeenCalledTimes(2);
  });
});

describe('PaymentReconciler.runOnce — webhook-only expiry', () => {
  beforeEach(() => {
    reconcileMock.mockReset();
    expireMock.mockReset();
  });

  it('fails each expired attempt and counts it as abandoned, with no provider call', async () => {
    expireMock.mockResolvedValue('expired');
    const { reconciler } = build({ expired: [{ id: 'e1' }, { id: 'e2' }] });

    const summary = await reconciler.runOnce(1);

    expect(expireMock).toHaveBeenCalledTimes(2);
    expect(expireMock).toHaveBeenCalledWith(expect.anything(), 'e1');
    expect(expireMock).toHaveBeenCalledWith(expect.anything(), 'e2');
    expect(summary.abandoned).toBe(2);
    expect(reconcileMock).not.toHaveBeenCalled();
  });

  it('does not count an attempt a webhook settled first (skipped)', async () => {
    expireMock.mockResolvedValue('skipped');
    const { reconciler } = build({ expired: [{ id: 'e1' }] });

    expect((await reconciler.runOnce(1)).abandoned).toBe(0);
  });

  it('keeps going after one attempt fails to expire', async () => {
    expireMock.mockResolvedValueOnce('error').mockResolvedValueOnce('expired');
    const { reconciler } = build({ expired: [{ id: 'e1' }, { id: 'e2' }] });

    expect((await reconciler.runOnce(1)).abandoned).toBe(1);
    expect(expireMock).toHaveBeenCalledTimes(2);
  });

  it('expires even when no provider is configured to poll', async () => {
    expireMock.mockResolvedValue('expired');
    const { reconciler } = build({ expired: [{ id: 'e1' }], providers: [] });

    const summary = await reconciler.runOnce(1);

    expect(summary.abandoned).toBe(1);
    expect(summary.checked).toBe(0);
  });
});

describe('PaymentReconciler timer', () => {
  const BASE = 15_000;
  const IDLE = 60_000;

  beforeEach(() => {
    reconcileMock.mockReset();
    expireMock.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Each tick issues three selects (purchases, webhook expiries, candidates).
   * `candidatesFor(tickIndex)` supplies the third one.
   */
  function buildLoop(candidatesFor: (tick: number) => unknown[]) {
    let call = 0;
    const select = jest.fn(() => {
      const tick = Math.floor(call / 3);
      const isCandidates = call % 3 === 2;
      call += 1;
      return chain(isCandidates ? candidatesFor(tick) : []);
    });
    const reconciler = new PaymentReconciler(
      { select } as never,
      {} as never,
      { wakeupAfterCommit: jest.fn() } as never,
      { activatePaidPurchase: jest.fn() } as never,
      {
        get: jest.fn((key: string) => {
          if (key === 'payment.reconcileProviders') return ['bakong'];
          if (key === 'payment.reconcileIntervalMs') return BASE;
          if (key === 'payment.reconcileIdleIntervalMs') return IDLE;
          return undefined;
        }),
      } as never,
    );
    const ticks = () => Math.floor(select.mock.calls.length / 3);
    return { reconciler, ticks };
  }

  it('still runs a tick immediately at boot', async () => {
    const { reconciler, ticks } = buildLoop(() => []);

    reconciler.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);

    expect(ticks()).toBe(1);
    reconciler.onModuleDestroy();
  });

  it('stretches to the idle interval while there is nothing to look at', async () => {
    const { reconciler, ticks } = buildLoop(() => []);

    reconciler.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(BASE * 3);
    expect(ticks()).toBe(1);

    await jest.advanceTimersByTimeAsync(IDLE);
    expect(ticks()).toBe(2);
    reconciler.onModuleDestroy();
  });

  it('keeps the base interval while an unresolved attempt exists', async () => {
    const { reconciler, ticks } = buildLoop(() => [attempt('a1', MINUTE)]);
    reconcileMock.mockResolvedValue('pending');

    reconciler.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(BASE * 4);

    expect(ticks()).toBe(5);
    reconciler.onModuleDestroy();
  });

  it('returns to the base interval once an attempt shows up, and relaxes again after', async () => {
    // Tick 0 idle, tick 1 sees an attempt, tick 2 sees none.
    const { reconciler, ticks } = buildLoop((tick) =>
      tick === 1 ? [attempt('a1', MINUTE)] : [],
    );
    reconcileMock.mockResolvedValue('pending');

    reconciler.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(IDLE); // tick 1 (found an attempt)
    expect(ticks()).toBe(2);

    await jest.advanceTimersByTimeAsync(BASE); // tick 2 (empty again)
    expect(ticks()).toBe(3);

    await jest.advanceTimersByTimeAsync(BASE * 3);
    expect(ticks()).toBe(3); // idle again: no tick inside the base window
    reconciler.onModuleDestroy();
  });

  it('stops ticking after shutdown', async () => {
    const { reconciler, ticks } = buildLoop(() => []);

    reconciler.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    reconciler.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(IDLE * 5);

    expect(ticks()).toBe(1);
  });
});
