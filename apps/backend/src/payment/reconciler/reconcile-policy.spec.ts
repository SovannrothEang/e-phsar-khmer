import {
  RECOVERABLE_FAILURE_CODES,
  isDueThisTick,
  isReconcilable,
} from './reconcile-policy';

describe('isReconcilable', () => {
  it('always reconciles a pending attempt', () => {
    expect(isReconcilable({ status: 'pending', failureCode: null })).toBe(true);
  });

  it.each(RECOVERABLE_FAILURE_CODES)(
    'revisits an attempt we failed by timeout (%s) — it may still have been paid',
    (failureCode) => {
      expect(isReconcilable({ status: 'failed', failureCode })).toBe(true);
    },
  );

  it.each([
    'CHARGE_GATEWAY_ERROR', // no QR ever existed — nothing to pay
    'PROVIDER_NOT_REGISTERED',
    'GATEWAY_NOT_CONFIGURED',
    'SOMETHING_ELSE',
  ])('does not revisit a genuine failure (%s)', (failureCode) => {
    expect(isReconcilable({ status: 'failed', failureCode })).toBe(false);
  });

  it('does not revisit a failed attempt with no failure code', () => {
    expect(isReconcilable({ status: 'failed', failureCode: null })).toBe(false);
  });

  it('never revisits a succeeded attempt', () => {
    expect(isReconcilable({ status: 'succeeded', failureCode: null })).toBe(
      false,
    );
  });
});

describe('isDueThisTick', () => {
  const options = { fastWindowMs: 30 * 60_000, slowEveryTicks: 20 };

  it('checks a young attempt on every tick', () => {
    for (let tick = 1; tick <= 25; tick++) {
      expect(isDueThisTick(60_000, tick, options)).toBe(true);
    }
  });

  it('checks an old attempt only on every Nth tick', () => {
    const due = Array.from({ length: 40 }, (_, i) => i + 1).filter((tick) =>
      isDueThisTick(2 * 60 * 60_000, tick, options),
    );
    expect(due).toEqual([20, 40]);
  });

  it('treats the fast-window boundary as old', () => {
    expect(isDueThisTick(options.fastWindowMs, 1, options)).toBe(false);
  });
});
