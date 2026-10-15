import { PaymentReconciler } from './payment-reconciler.service';
import { runReconcileAttempt } from './run-reconcile-attempt';

// The Effect bridge is mocked at its Promise boundary — `effect` is ESM-only
// and Jest never needs to load it to test the sweep's own logic.
jest.mock('./run-reconcile-attempt', () => ({
  runReconcileAttempt: jest.fn(),
}));

const reconcileMock = runReconcileAttempt as unknown as jest.Mock;

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
  candidates?: unknown[];
  providers?: string[];
  activate?: jest.Mock;
}) {
  const db = {
    select: jest
      .fn()
      // 1st select = purchases awaiting activation, 2nd = attempts to reconcile.
      .mockReturnValueOnce(chain(opts.stuck ?? []))
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
  beforeEach(() => reconcileMock.mockReset());

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
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
