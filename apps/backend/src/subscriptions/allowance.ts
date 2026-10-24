import type { FreePlanSettings, PlanLimits } from './entitlements.constants';

/**
 * Where an ad's limits come from. Every ad lands in exactly one bucket:
 *
 *   group:<id>  its subcategory is covered by a group the owner holds — the
 *               group's package limits, `ads` shared by all of its subcategories
 *   sub:<id>    a free-plan cap on its subcategory ("Cars for sale: 2")
 *   cat:<id>    a free-plan cap on its category ("Foods: 50")
 *   other       everything else, sharing the free plan's `otherAds`
 *
 * A subcategory covered by a group the owner does NOT hold falls through to
 * the free buckets, exactly as if no group covered it.
 */
export type BucketKey =
  | `group:${string}`
  | `sub:${string}`
  | `cat:${string}`
  | 'other';

export interface AllowanceConfig {
  free: FreePlanSettings;
  /** subcategoryId → subscription category (group) id */
  subcategoryGroup: ReadonlyMap<string, string>;
  /** subcategoryId → free ad cap */
  subcategoryCaps: ReadonlyMap<string, number>;
  /** categoryId → free ad cap */
  categoryCaps: ReadonlyMap<string, number>;
}

export interface HeldGroup {
  groupId: string;
  limits: PlanLimits;
  expiresAt: Date;
}

export interface Bucket {
  key: BucketKey;
  kind: 'group' | 'free';
  groupId: string | null;
  limits: PlanLimits;
}

export interface AdScope {
  categoryId: string;
  subcategoryId: string;
}

export function freeLimits(free: FreePlanSettings, ads: number): PlanLimits {
  return {
    photos: free.photos,
    ads,
    renews: free.renews,
    autoRenews: free.autoRenews,
    videos: free.videos,
  };
}

export function groupBucket(
  groupId: string,
  config: AllowanceConfig,
  held: ReadonlyMap<string, HeldGroup>,
): Bucket | undefined {
  const group = held.get(groupId);
  if (!group) return undefined;
  const { free } = config;
  return {
    key: `group:${group.groupId}`,
    kind: 'group',
    groupId: group.groupId,
    // A subscriber is never worse off per ad than the free plan; the ad
    // pool is the package's own number, since it replaces the free caps.
    limits: {
      photos: Math.max(free.photos, group.limits.photos),
      ads: group.limits.ads,
      renews: Math.max(free.renews, group.limits.renews),
      autoRenews: Math.max(free.autoRenews, group.limits.autoRenews),
      videos: Math.max(free.videos, group.limits.videos),
    },
  };
}

export function bucketOf(
  ad: AdScope,
  config: AllowanceConfig,
  held: ReadonlyMap<string, HeldGroup>,
): Bucket {
  const groupId = config.subcategoryGroup.get(ad.subcategoryId);
  const group = groupId ? groupBucket(groupId, config, held) : undefined;
  if (group) return group;

  const subCap = config.subcategoryCaps.get(ad.subcategoryId);
  if (subCap !== undefined) {
    return {
      key: `sub:${ad.subcategoryId}`,
      kind: 'free',
      groupId: null,
      limits: freeLimits(config.free, subCap),
    };
  }
  const catCap = config.categoryCaps.get(ad.categoryId);
  if (catCap !== undefined) {
    return {
      key: `cat:${ad.categoryId}`,
      kind: 'free',
      groupId: null,
      limits: freeLimits(config.free, catCap),
    };
  }
  return {
    key: 'other',
    kind: 'free',
    groupId: null,
    limits: freeLimits(config.free, config.free.otherAds),
  };
}

export interface LiveAd extends AdScope {
  id: string;
  status: string;
}

/**
 * Splits a user's live ads (newest first) into the ones that fit their
 * bucket's allowance and the ones beyond it. Pure — the caller writes.
 */
export function partitionByAllowance<T extends LiveAd>(
  liveNewestFirst: readonly T[],
  config: AllowanceConfig,
  held: ReadonlyMap<string, HeldGroup>,
): { within: T[]; beyond: T[] } {
  const used = new Map<BucketKey, number>();
  const within: T[] = [];
  const beyond: T[] = [];
  for (const ad of liveNewestFirst) {
    const bucket = bucketOf(ad, config, held);
    const count = used.get(bucket.key) ?? 0;
    if (count < bucket.limits.ads) within.push(ad);
    else beyond.push(ad);
    used.set(bucket.key, count + 1);
  }
  return { within, beyond };
}
