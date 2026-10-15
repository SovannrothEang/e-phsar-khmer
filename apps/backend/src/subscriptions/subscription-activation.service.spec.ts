import { SubscriptionActivationService } from './subscription-activation.service';

function makePurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'purchase-1',
    userId: 'user-1',
    termId: 'term-1',
    paymentTransactionId: 'payment-1',
    status: 'pending',
    amountUsd: '10.00',
    currency: 'USD',
    offerSnapshot: { durationValue: 1, durationUnit: 'month' },
    ...overrides,
  };
}

function makePurchaseQuery(purchase: ReturnType<typeof makePurchase>) {
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    for: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([purchase]),
  };
}

describe('SubscriptionActivationService', () => {
  it.each([
    ['transaction ID', { paymentTransactionId: 'another-payment' }],
    ['customer', { customerId: 'another-user' }],
    ['amount', { amount: '0.01' }],
    ['currency', { currency: 'KHR' }],
  ])(
    'does not grant subscription for mismatched %s',
    async (_field, changed) => {
      const purchase = makePurchase();
      const purchaseQuery = makePurchaseQuery(purchase);
      const tx = {
        select: jest.fn().mockReturnValue(purchaseQuery),
        insert: jest.fn(),
        update: jest.fn(),
      };
      const db = {
        transaction: jest.fn((callback: (executor: unknown) => unknown) =>
          callback(tx),
        ),
      };
      const service = new SubscriptionActivationService(
        db as never,
        { reconcileListingsSafely: jest.fn() } as never,
      );

      const result = await service.activatePaidPurchase({
        purchaseId: purchase.id,
        paymentTransactionId: 'payment-1',
        customerId: 'user-1',
        amount: '10.00',
        currency: 'USD',
        ...changed,
      });

      expect(result).toEqual({ status: 'payment_mismatch' });
      expect(purchaseQuery.for).toHaveBeenCalledWith('update');
      expect(tx.insert).not.toHaveBeenCalled();
      expect(tx.update).not.toHaveBeenCalled();
    },
  );

  it('does not create a second entitlement when purchase already paid', async () => {
    const purchase = makePurchase({ status: 'paid' });
    const tx = {
      select: jest.fn().mockReturnValue(makePurchaseQuery(purchase)),
      insert: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      transaction: jest.fn((callback: (executor: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const service = new SubscriptionActivationService(
      db as never,
      { reconcileListingsSafely: jest.fn() } as never,
    );

    const result = await service.activatePaidPurchase({
      purchaseId: purchase.id,
      paymentTransactionId: 'payment-1',
      customerId: 'user-1',
      amount: '10.00',
      currency: 'USD',
    });

    expect(result).toEqual({ status: 'already_paid' });
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('retries settlement until checkout links the payment transaction', async () => {
    const purchase = makePurchase({ paymentTransactionId: null });
    const tx = {
      select: jest.fn().mockReturnValue(makePurchaseQuery(purchase)),
      insert: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      transaction: jest.fn((callback: (executor: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const service = new SubscriptionActivationService(
      db as never,
      { reconcileListingsSafely: jest.fn() } as never,
    );

    const result = await service.activatePaidPurchase({
      purchaseId: purchase.id,
      paymentTransactionId: 'payment-1',
      customerId: 'user-1',
      amount: '10.00',
      currency: 'USD',
    });

    expect(result).toEqual({ status: 'payment_link_pending' });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('activates a purchase only after its linked payment settles', async () => {
    const purchase = makePurchase();
    const purchaseQuery = makePurchaseQuery(purchase);
    const userLockQuery = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      for: jest.fn().mockResolvedValue([{ id: purchase.userId }]),
    };
    const activeSubscriptionQuery = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(purchaseQuery)
        .mockReturnValueOnce(userLockQuery)
        .mockReturnValueOnce(activeSubscriptionQuery),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'subscription-1' }]),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    const db = {
      transaction: jest.fn((callback: (executor: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const service = new SubscriptionActivationService(
      db as never,
      { reconcileListingsSafely: jest.fn() } as never,
    );

    const result = await service.activatePaidPurchase({
      purchaseId: purchase.id,
      paymentTransactionId: 'payment-1',
      customerId: 'user-1',
      amount: '10.00',
      currency: 'USD',
    });

    expect(result).toEqual({
      status: 'activated',
      subscriptionId: 'subscription-1',
    });
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['paid upgrade keeps the current expiry', 'upgrade', true],
    ['manual comp starts a fresh full term', 'manual_comp', false],
  ])('%s', async (_name, kind, keepsExpiry) => {
    const purchase = makePurchase({ kind });
    const activeExpiry = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    const insertValues = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: 'subscription-2' }]),
    });
    const chain = (rows: unknown) => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      for: jest.fn().mockResolvedValue(rows),
      limit: jest.fn().mockResolvedValue(rows),
    });
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(makePurchaseQuery(purchase))
        .mockReturnValueOnce(chain([{ id: purchase.userId }]))
        .mockReturnValueOnce(
          chain([{ id: 'old-sub', expiresAt: activeExpiry }]),
        ),
      insert: jest.fn().mockReturnValue({ values: insertValues }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    const db = {
      transaction: jest.fn((callback: (executor: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const service = new SubscriptionActivationService(
      db as never,
      { reconcileListingsSafely: jest.fn() } as never,
    );

    const settlement = {
      purchaseId: purchase.id,
      paymentTransactionId: 'payment-1',
      customerId: 'user-1',
      amount: '10.00',
      currency: 'USD',
    };
    if (kind === 'manual_comp') {
      await (
        service as unknown as {
          activatePurchaseInTx: (t: unknown, id: string) => Promise<unknown>;
        }
      ).activatePurchaseInTx(tx, purchase.id);
    } else {
      await service.activatePaidPurchase(settlement);
    }

    const inserted = (insertValues.mock.calls as [{ expiresAt: Date }][])[0][0];
    if (keepsExpiry) {
      expect(inserted.expiresAt).toEqual(activeExpiry);
    } else {
      expect(inserted.expiresAt.getTime()).toBeGreaterThan(
        activeExpiry.getTime(),
      );
    }
  });
});
