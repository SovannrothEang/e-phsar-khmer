import { EntitlementsService } from './entitlements.service';
import { DEFAULT_FREE_PLAN } from './entitlements.constants';

// A drizzle-style query builder: every call chains, awaiting resolves `rows`.
function query(rows: unknown[]) {
  const q: Record<string, unknown> = {};
  for (const method of [
    'from',
    'leftJoin',
    'innerJoin',
    'where',
    'orderBy',
    'groupBy',
    'having',
    'limit',
  ]) {
    q[method] = jest.fn(() => q);
  }
  q.then = (resolve: (value: unknown[]) => unknown) => resolve(rows);
  return q;
}

interface Setup {
  settings?: unknown[];
  scopes?: { subcategoryId: string; groupId: string }[];
  caps?: {
    categoryId: string | null;
    subcategoryId: string | null;
    ads: number;
  }[];
  held?: unknown[];
  live?: unknown[];
}

/**
 * Selects are issued in a fixed order: free settings, group scopes, free caps,
 * held subscriptions, then (when the call needs them) live ads.
 */
function makeService(setup: Setup, withLive = false) {
  const select = jest.fn();
  const batches = [
    setup.settings ?? [],
    setup.scopes ?? [],
    setup.caps ?? [],
    setup.held ?? [],
    ...(withLive ? [setup.live ?? []] : []),
  ];
  for (const rows of batches) select.mockReturnValueOnce(query(rows));
  const set = jest.fn(() => ({
    where: jest.fn().mockResolvedValue(undefined),
  }));
  const update = jest.fn(() => ({ set }));
  const service = new EntitlementsService({ select, update } as never);
  return { service, update, set };
}

const future = new Date(Date.now() + 10 * 24 * 3600 * 1000);
const cars = { categoryId: 'vehicles', subcategoryId: 'cars' };
const scopes = [{ subcategoryId: 'cars', groupId: 'auto' }];
const caps = [{ categoryId: null, subcategoryId: 'cars', ads: 2 }];
const autoSub = {
  groupId: 'auto',
  expiresAt: future,
  offerSnapshot: { photos: 20, ads: 50, renews: 4 },
  photos: 1,
  ads: 1,
  renews: 1,
  autoRenews: 0,
  videos: 2,
};

describe('EntitlementsService.resolve', () => {
  it('gives the free plan defaults when nothing is configured or held', async () => {
    const { service } = makeService({});
    const result = await service.resolve('u1', cars);
    expect(result.plan).toBe('free');
    expect(result.limits).toEqual({
      photos: DEFAULT_FREE_PLAN.photos,
      ads: DEFAULT_FREE_PLAN.otherAds,
      renews: DEFAULT_FREE_PLAN.renews,
      autoRenews: 0,
      videos: 0,
    });
  });

  it('reads the free plan from its settings row and caps', async () => {
    const { service } = makeService({
      settings: [
        { photos: 3, renews: 1, autoRenews: 0, videos: 0, otherAds: 9 },
      ],
      caps,
    });
    const { limits } = await service.resolve('u1', cars);
    expect(limits.ads).toBe(2);
    expect(limits.photos).toBe(3);
  });

  it("applies a held group's frozen snapshot to ads in its scope", async () => {
    const { service } = makeService({ scopes, caps, held: [autoSub] });
    const result = await service.resolve('u1', cars);
    expect(result.plan).toBe('premium');
    expect(result.bucket.key).toBe('group:auto');
    expect(result.limits).toMatchObject({ ads: 50, photos: 20, renews: 5 });
    expect(result.expiresAt).toEqual(future);
  });

  it('keeps ads outside the held group on the free plan', async () => {
    const { service } = makeService({ scopes, caps, held: [autoSub] });
    const result = await service.resolve('u1', {
      categoryId: 'pets',
      subcategoryId: 'dogs',
    });
    expect(result.bucket.key).toBe('other');
    expect(result.limits.ads).toBe(DEFAULT_FREE_PLAN.otherAds);
    expect(result.expiresAt).toBeNull();
  });
});

describe('EntitlementsService limit checks', () => {
  it('rejects more photos than the plan allows', async () => {
    const { service } = makeService({});
    await expect(
      service.assertPhotos('u1', cars, DEFAULT_FREE_PLAN.photos + 1),
    ).rejects.toMatchObject({ response: { code: 'PLAN_LIMIT_PHOTOS' } });
  });

  it('grandfathers photos an ad already carries', async () => {
    const { service } = makeService({});
    await expect(
      service.assertPhotos('u1', cars, 12, 12),
    ).resolves.toBeUndefined();
  });

  it('blocks a new ad once its bucket is full, counting only that bucket', async () => {
    const live = [
      { id: 'a', status: 'active', ...cars },
      { id: 'b', status: 'active', ...cars },
      { id: 'c', status: 'active', categoryId: 'pets', subcategoryId: 'dogs' },
    ];
    const { service } = makeService({ caps, live }, true);
    await expect(
      service.assertCanHoldAnotherAd('u1', { id: 'new', ...cars }),
    ).rejects.toMatchObject({ response: { code: 'PLAN_LIMIT_ADS' } });
  });

  it('does not count the ad being re-published against itself', async () => {
    const live = [
      { id: 'a', status: 'active', ...cars },
      { id: 'b', status: 'active', ...cars },
    ];
    const { service } = makeService({ caps, live }, true);
    await expect(
      service.assertCanHoldAnotherAd('u1', { id: 'b', ...cars }),
    ).resolves.toBeUndefined();
  });

  it('blocks renewals once the per-ad allowance is used', async () => {
    const { service } = makeService({});
    await expect(
      service.assertCanRenew('u1', cars, DEFAULT_FREE_PLAN.renews),
    ).rejects.toMatchObject({ response: { code: 'PLAN_LIMIT_RENEWS' } });
  });
});

describe('EntitlementsService.reconcileListings', () => {
  it('restricts the oldest ads beyond their bucket and restores none', async () => {
    // newest → oldest; cars-for-sale keeps the first 2
    const live = ['a', 'b', 'c'].map((id) => ({
      id,
      status: 'active',
      ...cars,
    }));
    const { service, update, set } = makeService({ caps, live }, true);
    const result = await service.reconcileListings('u1');
    expect(result).toEqual({ restricted: 1, restored: 0 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'restricted' }),
    );
  });

  it('restores restricted ads once a held group covers them', async () => {
    const live = [
      { id: 'a', status: 'active', ...cars },
      { id: 'b', status: 'active', ...cars },
      { id: 'c', status: 'restricted', ...cars },
    ];
    const { service, set } = makeService(
      { scopes, caps, held: [autoSub], live },
      true,
    );
    const result = await service.reconcileListings('u1');
    expect(result).toEqual({ restricted: 0, restored: 1 });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('does nothing when the ads already match the allowance', async () => {
    const live = [{ id: 'a', status: 'active', ...cars }];
    const { service, update } = makeService({ caps, live }, true);
    await service.reconcileListings('u1');
    expect(update).not.toHaveBeenCalled();
  });
});
