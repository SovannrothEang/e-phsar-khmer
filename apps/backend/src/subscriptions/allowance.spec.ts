import { bucketOf, partitionByAllowance } from './allowance';
import type { AllowanceConfig, HeldGroup } from './allowance';
import { DEFAULT_FREE_PLAN } from './entitlements.constants';

// cars-and-vehicles: cars-for-sale (capped 2), parts (no cap) — in group "auto"
// foods: meat — category capped 50, in group "food"
// pets: dogs — no cap, no group → "other"
const config: AllowanceConfig = {
  free: { ...DEFAULT_FREE_PLAN },
  subcategoryGroup: new Map([
    ['cars', 'auto'],
    ['parts', 'auto'],
    ['meat', 'food'],
  ]),
  subcategoryCaps: new Map([['cars', 2]]),
  categoryCaps: new Map([['foods', 50]]),
};

const cars = { categoryId: 'vehicles', subcategoryId: 'cars' };
const parts = { categoryId: 'vehicles', subcategoryId: 'parts' };
const meat = { categoryId: 'foods', subcategoryId: 'meat' };
const dogs = { categoryId: 'pets', subcategoryId: 'dogs' };

const auto: HeldGroup = {
  groupId: 'auto',
  limits: { photos: 24, ads: 30, renews: 10, autoRenews: 20, videos: 10 },
  expiresAt: new Date(Date.now() + 86_400_000),
};
const holding = (...groups: HeldGroup[]) =>
  new Map(groups.map((g) => [g.groupId, g]));

describe('bucketOf', () => {
  it('uses the free subcategory cap when the group is not held', () => {
    const bucket = bucketOf(cars, config, holding());
    expect(bucket).toMatchObject({ key: 'sub:cars', kind: 'free' });
    expect(bucket.limits).toMatchObject({ ads: 2, photos: 8, renews: 5 });
  });

  it('falls back to the category cap, then to other ads', () => {
    expect(bucketOf(meat, config, holding()).key).toBe('cat:foods');
    expect(bucketOf(meat, config, holding()).limits.ads).toBe(50);
    expect(bucketOf(dogs, config, holding()).key).toBe('other');
    expect(bucketOf(dogs, config, holding()).limits.ads).toBe(5);
    expect(bucketOf(parts, config, holding()).key).toBe('other');
  });

  it('puts every subcategory of a held group in one shared pool', () => {
    const held = holding(auto);
    expect(bucketOf(cars, config, held).key).toBe('group:auto');
    expect(bucketOf(parts, config, held).key).toBe('group:auto');
    expect(bucketOf(cars, config, held).limits).toEqual(auto.limits);
  });

  it('leaves other groups on the free plan', () => {
    expect(bucketOf(meat, config, holding(auto)).key).toBe('cat:foods');
  });

  it('never gives a subscriber fewer photos or renews than free', () => {
    const stingy: HeldGroup = {
      ...auto,
      limits: { photos: 1, ads: 30, renews: 0, autoRenews: 0, videos: 0 },
    };
    const { limits } = bucketOf(cars, config, holding(stingy));
    expect(limits.photos).toBe(8);
    expect(limits.renews).toBe(5);
    expect(limits.ads).toBe(30);
  });
});

describe('partitionByAllowance', () => {
  const ad = (id: string, scope: typeof cars) => ({
    id,
    status: 'active',
    ...scope,
  });

  it('caps each bucket independently, newest first', () => {
    const live = [
      ad('c1', cars),
      ad('d1', dogs),
      ad('c2', cars),
      ad('c3', cars),
      ad('p1', parts),
    ];
    const { within, beyond } = partitionByAllowance(live, config, holding());
    expect(beyond.map((a) => a.id)).toEqual(['c3']);
    expect(within.map((a) => a.id)).toEqual(['c1', 'd1', 'c2', 'p1']);
  });

  it('lifts the free caps once the group is held', () => {
    const live = [ad('c1', cars), ad('c2', cars), ad('c3', cars)];
    const { beyond } = partitionByAllowance(live, config, holding(auto));
    expect(beyond).toEqual([]);
  });
});
