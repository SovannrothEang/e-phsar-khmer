import { EntitlementsService } from './entitlements.service';
import { FREE_PLAN_LIMITS } from './entitlements.constants';

// A drizzle-style query builder: every call chains, awaiting resolves `rows`.
function query(rows: unknown[]) {
  const q: Record<string, unknown> = {};
  for (const method of [
    'from',
    'leftJoin',
    'where',
    'orderBy',
    'groupBy',
    'having',
  ]) {
    q[method] = jest.fn(() => q);
  }
  q.then = (resolve: (value: unknown[]) => unknown) => resolve(rows);
  return q;
}

function makeService(selects: unknown[][]) {
  const select = jest.fn();
  for (const rows of selects) select.mockReturnValueOnce(query(rows));
  const set = jest.fn(() => ({
    where: jest.fn().mockResolvedValue(undefined),
  }));
  const update = jest.fn(() => ({ set }));
  const service = new EntitlementsService({ select, update } as never);
  return { service, update, set };
}

const future = new Date(Date.now() + 10 * 24 * 3600 * 1000);

describe('EntitlementsService.resolve', () => {
  it('gives the free plan when no subscription is live', async () => {
    const { service } = makeService([[]]);
    await expect(service.resolve('u1')).resolves.toEqual({
      plan: 'free',
      limits: FREE_PLAN_LIMITS,
      expiresAt: null,
    });
  });

  it('reads limits from the frozen offer snapshot before the live package', async () => {
    const { service } = makeService([
      [
        {
          expiresAt: future,
          offerSnapshot: { photos: 20, ads: 50, renews: 4 },
          photos: 1,
          ads: 1,
          renews: 1,
          autoRenews: 0,
          videos: 2,
        },
      ],
    ]);
    const result = await service.resolve('u1');
    expect(result.plan).toBe('premium');
    expect(result.limits).toEqual({
      photos: 20,
      ads: 50,
      renews: 4,
      autoRenews: 0,
      videos: 2,
    });
    expect(result.expiresAt).toEqual(future);
  });

  it('never drops a subscriber below the free plan', async () => {
    const { service } = makeService([
      [
        {
          expiresAt: future,
          offerSnapshot: null,
          photos: 0,
          ads: 0,
          renews: 0,
          autoRenews: 0,
          videos: 0,
        },
      ],
    ]);
    const { limits } = await service.resolve('u1');
    expect(limits.ads).toBe(FREE_PLAN_LIMITS.ads);
    expect(limits.photos).toBe(FREE_PLAN_LIMITS.photos);
  });
});

describe('EntitlementsService limit checks', () => {
  it('rejects more photos than the plan allows', async () => {
    const { service } = makeService([[]]);
    await expect(
      service.assertPhotos('u1', FREE_PLAN_LIMITS.photos + 1),
    ).rejects.toMatchObject({ response: { code: 'PLAN_LIMIT_PHOTOS' } });
  });

  it('grandfathers photos an ad already carries', async () => {
    const { service } = makeService([[]]);
    await expect(service.assertPhotos('u1', 8, 8)).resolves.toBeUndefined();
  });

  it('blocks a new ad once the active-ad allowance is used', async () => {
    const { service } = makeService([[], [{ count: FREE_PLAN_LIMITS.ads }]]);
    await expect(service.assertCanHoldAnotherAd('u1')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_ADS' },
    });
  });

  it('blocks renewals on a plan with none', async () => {
    const { service } = makeService([[]]);
    await expect(service.assertCanRenew('u1', 0)).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_RENEWS' },
    });
  });
});

describe('EntitlementsService.reconcileListings', () => {
  it('restricts the oldest ads beyond the allowance and restores none', async () => {
    // newest → oldest; free plan keeps the first 3
    const live = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
      id,
      status: 'active',
    }));
    const { service, update, set } = makeService([[], live]);
    const result = await service.reconcileListings('u1');
    expect(result).toEqual({ restricted: 2, restored: 0 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'restricted' }),
    );
  });

  it('restores restricted ads once the allowance covers them again', async () => {
    const live = [
      { id: 'a', status: 'active' },
      { id: 'b', status: 'restricted' },
    ];
    const { service, set } = makeService([[], live]);
    const result = await service.reconcileListings('u1');
    expect(result).toEqual({ restricted: 0, restored: 1 });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('does nothing when the ads already match the allowance', async () => {
    const live = [{ id: 'a', status: 'active' }];
    const { service, update } = makeService([[], live]);
    await service.reconcileListings('u1');
    expect(update).not.toHaveBeenCalled();
  });
});
