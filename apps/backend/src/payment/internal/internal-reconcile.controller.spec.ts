import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  InternalReconcileController,
  SECRET_HEADER,
} from './internal-reconcile.controller';
import type { ReconcileSummary } from '../reconciler/payment-reconciler.service';

// The reconciler's Effect bridge is ESM-only; this spec only needs the class
// symbol for DI, so it is mocked at the module boundary like the reconciler's
// own spec does.
jest.mock('../reconciler/payment-reconciler.service', () => ({
  PaymentReconciler: class PaymentReconciler {},
}));

// `@nestjs/throttler` is ESM-only under Jest; the decorator itself is inert in
// a direct controller test, but importing it would fail to parse.
jest.mock('@nestjs/throttler', () => ({
  SkipThrottle: () => () => undefined,
}));

const SECRET = 'a-16-char-secret-value';

function setup(values: Record<string, unknown>) {
  const summary: ReconcileSummary = {
    candidates: 2,
    checked: 2,
    settled: 1,
    activated: 1,
    abandoned: 0,
    errors: 0,
    pending: 1,
    newestPendingAgeMs: 1_000,
    providerEventsRedriven: 0,
    providerEventsExhausted: 0,
    providerEventsPurged: 0,
    deadlineReached: false,
    skippedBackoff: 0,
  };
  const reconciler = { runExclusive: jest.fn().mockResolvedValue(summary) };
  const config = {
    get: jest.fn((key: string) => values[key]),
  };
  const controller = new InternalReconcileController(
    reconciler as never,
    config as never,
  );
  return { controller, reconciler, summary };
}

describe('InternalReconcileController', () => {
  it('uses the documented header name', () => {
    expect(SECRET_HEADER).toBe('x-internal-secret');
  });

  it('fails closed when no secret is configured', async () => {
    const { controller, reconciler } = setup({
      'payment.reconcileProviders': ['bakong'],
    });

    await expect(controller.reconcile(SECRET)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(reconciler.runExclusive).not.toHaveBeenCalled();
  });

  it('rejects a missing, empty or wrong secret without running a pass', async () => {
    const { controller, reconciler } = setup({
      'internal.secret': SECRET,
      'payment.reconcileProviders': ['bakong'],
    });

    await expect(controller.reconcile(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.reconcile('')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.reconcile('wrong-secret-value'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(reconciler.runExclusive).not.toHaveBeenCalled();
  });

  it('runs exactly one non-overlapping pass with the correct secret', async () => {
    const { controller, reconciler, summary } = setup({
      'internal.secret': SECRET,
      'payment.reconcileProviders': ['bakong'],
    });

    await expect(controller.reconcile(SECRET)).resolves.toEqual(summary);
    expect(reconciler.runExclusive).toHaveBeenCalledTimes(1);
  });

  it('still runs when the in-process timer is disabled', async () => {
    const { controller, reconciler, summary } = setup({
      'internal.secret': SECRET,
      'payment.reconcileProviders': ['bakong'],
      'payment.reconcilerEnabled': false,
    });

    await expect(controller.reconcile(SECRET)).resolves.toEqual(summary);
    expect(reconciler.runExclusive).toHaveBeenCalledTimes(1);
  });

  it('refuses when no provider is configured', async () => {
    const { controller, reconciler } = setup({
      'internal.secret': SECRET,
      'payment.reconcileProviders': [],
    });

    await expect(controller.reconcile(SECRET)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(reconciler.runExclusive).not.toHaveBeenCalled();
  });
});
