import { BadRequestException } from '@nestjs/common';
import { SubscriptionConfigService } from './subscription-config.service';

function query(rows: unknown[]) {
  const q: Record<string, unknown> = {};
  for (const method of ['from', 'innerJoin', 'where', 'for', 'limit']) {
    q[method] = jest.fn(() => q);
  }
  q.then = (resolve: (value: unknown[]) => unknown) => resolve(rows);
  return q;
}

const groupId = 'group-1';
const subcategoryId = 'subcategory-1';
const validFreePlan = {
  photos: 8,
  renews: 5,
  autoRenews: 0,
  videos: 0,
  otherAds: 5,
  adLimits: [{ categoryId: undefined, subcategoryId, ads: 2 }],
};

function makeScopeDb({
  groupRows = [{ id: groupId }],
  taken = [],
}: {
  groupRows?: unknown[];
  taken?: unknown[];
} = {}) {
  const select = jest
    .fn()
    .mockReturnValueOnce(query(groupRows))
    .mockReturnValueOnce(query(taken));
  const deleteWhere = jest.fn().mockResolvedValue([]);
  const deleteRows = jest.fn(() => ({ where: deleteWhere }));
  const insertValues = jest.fn().mockResolvedValue([]);
  const insert = jest.fn(() => ({ values: insertValues }));
  const tx = { select, delete: deleteRows, insert };
  const transaction = jest.fn((callback: (innerTx: typeof tx) => unknown) =>
    Promise.resolve(callback(tx)),
  );
  const db = { transaction };
  const scheduler = {
    enqueueConfigReconcile: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new SubscriptionConfigService(db as never, scheduler as never),
    transaction,
    deleteWhere,
    insertValues,
    scheduler,
  };
}

describe('SubscriptionConfigService.updateCategoryScope', () => {
  it('replaces a group scope and enqueues a reconciliation', async () => {
    const { service, transaction, deleteWhere, insertValues, scheduler } =
      makeScopeDb();

    await expect(
      service.updateCategoryScope(groupId, { subcategoryIds: [subcategoryId] }),
    ).resolves.toEqual({ id: groupId, subcategoryIds: [subcategoryId] });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith([
      { subscriptionCategoryId: groupId, subcategoryId },
    ]);
    expect(scheduler.enqueueConfigReconcile).toHaveBeenCalledTimes(1);
  });

  it('maps a concurrent unique-scope conflict to 409', async () => {
    const error = Object.assign(new Error('unique violation'), {
      code: '23505',
    });
    const service = new SubscriptionConfigService(
      { transaction: jest.fn().mockRejectedValue(error) } as never,
      { enqueueConfigReconcile: jest.fn() } as never,
    );

    await expect(
      service.updateCategoryScope(groupId, { subcategoryIds: [subcategoryId] }),
    ).rejects.toMatchObject({
      status: 409,
      message:
        'A subcategory was just added to another group. Reload and try again.',
    });
  });

  it('rethrows non-unique database errors', async () => {
    const error = new Error('database unavailable');
    const service = new SubscriptionConfigService(
      { transaction: jest.fn().mockRejectedValue(error) } as never,
      { enqueueConfigReconcile: jest.fn() } as never,
    );

    await expect(
      service.updateCategoryScope(groupId, { subcategoryIds: [subcategoryId] }),
    ).rejects.toBe(error);
  });
});

describe('SubscriptionConfigService.updateFreePlan', () => {
  it.each([
    ['both fields', { categoryId: 'category-1', subcategoryId, ads: 2 }],
    ['neither field', { categoryId: null, subcategoryId: null, ads: 2 }],
  ])('rejects a limit with %s', async (_label, limit) => {
    const service = new SubscriptionConfigService(
      { transaction: jest.fn() } as never,
      { enqueueConfigReconcile: jest.fn() } as never,
    );

    await expect(
      service.updateFreePlan({ ...validFreePlan, adLimits: [limit] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate category or subcategory scopes', async () => {
    const service = new SubscriptionConfigService(
      { transaction: jest.fn() } as never,
      { enqueueConfigReconcile: jest.fn() } as never,
    );

    await expect(
      service.updateFreePlan({
        ...validFreePlan,
        adLimits: [
          { categoryId: undefined, subcategoryId, ads: 2 },
          { categoryId: undefined, subcategoryId, ads: 3 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes settings and replaces limits atomically, nulls category for subcategory caps, then returns the saved plan', async () => {
    const conflict = jest.fn().mockResolvedValue([]);
    const settingsValues = jest.fn(() => ({ onConflictDoUpdate: conflict }));
    const limitValues = jest.fn().mockResolvedValue([]);
    const insert = jest
      .fn()
      .mockReturnValueOnce({ values: settingsValues })
      .mockReturnValueOnce({ values: limitValues });
    const deleteWhere = jest.fn().mockResolvedValue([]);
    const deleteRows = jest.fn(() => ({ where: deleteWhere }));
    const tx = { insert, delete: deleteRows };
    const transaction = jest.fn((callback: (innerTx: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    );
    const selects = [
      query([{ ...validFreePlan, adLimits: undefined }]),
      query([{ id: 'limit-1', categoryId: null, subcategoryId, ads: 2 }]),
    ];
    const select = jest.fn(() => selects.shift());
    const scheduler = {
      enqueueConfigReconcile: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SubscriptionConfigService(
      { transaction, select } as never,
      scheduler as never,
    );

    await expect(service.updateFreePlan(validFreePlan)).resolves.toMatchObject({
      photos: 8,
      otherAds: 5,
      adLimits: [{ categoryId: null, subcategoryId, ads: 2 }],
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(settingsValues).toHaveBeenCalledWith({
      id: 1,
      photos: 8,
      renews: 5,
      autoRenews: 0,
      videos: 0,
      otherAds: 5,
    });
    expect(conflict).toHaveBeenCalledTimes(1);
    expect(deleteRows).toHaveBeenCalledTimes(1);
    expect(limitValues).toHaveBeenCalledWith([
      { categoryId: null, subcategoryId, ads: 2 },
    ]);
    expect(scheduler.enqueueConfigReconcile).toHaveBeenCalledTimes(1);
  });

  it('maps a concurrent free-plan unique conflict to a truthful 409', async () => {
    const error = Object.assign(new Error('unique violation'), {
      code: '23505',
    });
    const service = new SubscriptionConfigService(
      { transaction: jest.fn().mockRejectedValue(error) } as never,
      { enqueueConfigReconcile: jest.fn() } as never,
    );

    await expect(service.updateFreePlan(validFreePlan)).rejects.toMatchObject({
      status: 409,
      message:
        'The free plan was just changed by someone else. Reload and try again.',
    });
  });
});
