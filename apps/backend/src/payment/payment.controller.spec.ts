import { BadRequestException } from '@nestjs/common';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PaymentsController } from './payment.controller';
import { adminOverridePayment } from './use-cases';

jest.mock('./use-cases', () => ({
  adminOverridePayment: jest.fn(),
  checkOwnedPaymentTransaction: jest.fn(),
  createPaymentTransaction: jest.fn(),
  listOwnedPaymentAttempts: jest.fn(),
  listPayments: jest.fn(),
}));
jest.mock('./payment-effect-runner.service', () => ({
  PaymentEffectRunner: class PaymentEffectRunner {},
}));
jest.mock('./reconciler/payment-on-demand-reconciler.service', () => ({
  PaymentOnDemandReconciler: class PaymentOnDemandReconciler {},
}));
jest.mock('./providers', () => ({
  PaymentGatewayRegistry: class PaymentGatewayRegistry {},
}));

const overrideMock = adminOverridePayment as unknown as jest.Mock;

function setup() {
  const runner = {
    run: jest.fn(),
    runDurably: jest.fn((fn: (outbox: unknown) => unknown) => fn('outbox')),
  };
  const controller = new PaymentsController(
    runner as never,
    {} as never,
    {} as never,
  );
  return { controller, runner };
}

describe('PaymentsController.update', () => {
  beforeEach(() => overrideMock.mockReset().mockReturnValue('effect'));

  it('is restricted to super_admin — a plain admin cannot override a payment', () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/unbound-method -- metadata only, never invoked
      Reflect.getMetadata(ROLES_KEY, PaymentsController.prototype.update),
    ).toEqual(['super_admin']);
  });

  it('passes the acting user and the reason to the override use-case', async () => {
    const { controller } = setup();

    await controller.update({ id: 'admin-1' } as never, 'pay-1', {
      expectedVersion: 3,
      status: 'succeeded',
      reason: 'bank statement shows the transfer',
    } as never);

    expect(overrideMock).toHaveBeenCalledWith(
      'outbox',
      expect.objectContaining({
        id: 'pay-1',
        expectedVersion: 3,
        status: 'succeeded',
        actorId: 'admin-1',
        reason: 'bank statement shows the transfer',
      }),
    );
  });

  it('still refuses refunds before touching the use-case', () => {
    const { controller } = setup();

    expect(() =>
      controller.update({ id: 'admin-1' } as never, 'pay-1', {
        expectedVersion: 3,
        status: 'refunded',
      } as never),
    ).toThrow(BadRequestException);
    expect(overrideMock).not.toHaveBeenCalled();
  });
});
