import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalReconcileController } from './internal-reconcile.controller';
import type { ReconcileSummary } from '../reconciler/payment-reconciler.service';

// The reconciler's Effect bridge is ESM-only; this spec only needs the class
// symbol for DI, so it is mocked at the module boundary like the reconciler's
// own spec does.
jest.mock('../reconciler/payment-reconciler.service', () => ({
  PaymentReconciler: class PaymentReconciler {},
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
  };
  const reconciler = { runOnce: jest.fn().mockResolvedValue(summary) };
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
  it('fails closed when no secret is configured', async () => {
    const { controller, reconciler } = setup({
      'payment.reconcilerEnabled': true,
    });

    await expect(controller.reconcile(SECRET)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(reconciler.runOnce).not.toHaveBeenCalled();
  });

  it('rejects a missing or wrong secret without running a pass', async () => {
    const { controller, reconciler } = setup({
      'payment.internalReconcileSecret': SECRET,
      'payment.reconcilerEnabled': true,
    });

    await expect(controller.reconcile(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.reconcile('wrong-secret-value'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(reconciler.runOnce).not.toHaveBeenCalled();
  });

  it('runs exactly one pass with the correct secret', async () => {
    const { controller, reconciler, summary } = setup({
      'payment.internalReconcileSecret': SECRET,
      'payment.reconcilerEnabled': true,
    });

    await expect(controller.reconcile(SECRET)).resolves.toEqual(summary);
    expect(reconciler.runOnce).toHaveBeenCalledTimes(1);
  });

  it('refuses to run when the reconciler is disabled', async () => {
    const { controller, reconciler } = setup({
      'payment.internalReconcileSecret': SECRET,
      'payment.reconcilerEnabled': false,
    });

    await expect(controller.reconcile(SECRET)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(reconciler.runOnce).not.toHaveBeenCalled();
  });
});
