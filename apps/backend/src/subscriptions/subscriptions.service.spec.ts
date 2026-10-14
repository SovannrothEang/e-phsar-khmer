jest.mock('../payment/payment-effect-runner.service', () => ({
  PaymentEffectRunner: class {},
}));
jest.mock('../payment/use-cases', () => ({
  createPaymentTransaction: jest.fn(),
}));

import { createPaymentTransaction } from '../payment/use-cases';
import { SubscriptionsService } from './subscriptions.service';

function makeSelectQuery(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  };
}

describe('SubscriptionsService checkout recovery', () => {
  it('recreates payment for existing pending purchase with reserved transaction ID', async () => {
    const purchase = {
      id: 'purchase-1',
      termId: 'term-1',
      paymentTransactionId: 'payment-1',
      status: 'pending',
      amountUsd: '10.00',
      currency: 'USD',
    };
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(makeSelectQuery([purchase]))
        .mockReturnValueOnce(makeSelectQuery([])),
      update: jest.fn(),
    };
    const outbox = {};
    const paymentRunner = {
      runDurably: jest.fn((build) => {
        build(outbox as never);
        return Promise.resolve({ transaction: { id: 'payment-1' } });
      }),
    };
    const service = new SubscriptionsService(
      db as never,
      paymentRunner as never,
    );

    const result = await service.checkout('user-1', {
      termId: 'term-1',
      idempotencyKey: 'checkout-key-1',
    });

    expect(result).toEqual({
      purchaseId: 'purchase-1',
      paymentTransactionId: 'payment-1',
      amount: '10.00',
      currency: 'USD',
    });
    expect(paymentRunner.runDurably).toHaveBeenCalledTimes(1);
    expect(createPaymentTransaction).toHaveBeenCalledWith(
      outbox,
      expect.objectContaining({ transactionId: 'payment-1' }),
    );
    expect(db.update).not.toHaveBeenCalled();
  });
  it('closes the purchase and asks for a new checkout when its payment is dead', async () => {
    const purchase = {
      id: 'purchase-1',
      termId: 'term-1',
      paymentTransactionId: 'payment-1',
      status: 'pending',
      amountUsd: '10.00',
      currency: 'USD',
    };
    const where = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockReturnValue({ where });
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(makeSelectQuery([purchase]))
        .mockReturnValueOnce(
          makeSelectQuery([{ id: 'payment-1', status: 'failed' }]),
        ),
      update: jest.fn().mockReturnValue({ set }),
    };
    const service = new SubscriptionsService(db as never, {} as never);

    await expect(
      service.checkout('user-1', {
        termId: 'term-1',
        idempotencyKey: 'checkout-key-1',
      }),
    ).rejects.toThrow('Start a new checkout');
    expect(set).toHaveBeenCalledWith({ status: 'failed' });
  });
});
