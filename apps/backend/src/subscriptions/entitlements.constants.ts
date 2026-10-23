export interface PlanLimits {
  /** Photos per ad. */
  photos: number;
  /** Ads that may be live (active) at once in one allowance bucket. */
  ads: number;
  /** Times one ad may be re-published after its first publish. */
  renews: number;
  /** Auto-renewals — no auto-renew feature exists yet, so nothing spends this. */
  autoRenews: number;
  /** Videos per ad — listings carry no video yet, so nothing spends this. */
  videos: number;
}

/** The free plan's account-wide numbers (the `free_plan_settings` row). */
export interface FreePlanSettings {
  photos: number;
  renews: number;
  autoRenews: number;
  videos: number;
  /** Ads across every subcategory with no group or cap of its own. */
  otherAds: number;
}

/**
 * Used when the `free_plan_settings` row is missing, and as its seed values
 * (Khmer24's free plan, captured 2026-10-21). Admins edit the row afterwards.
 */
export const DEFAULT_FREE_PLAN: Readonly<FreePlanSettings> = {
  photos: 8,
  renews: 5,
  autoRenews: 0,
  videos: 0,
  otherAds: 5,
};

export function toFreePlanSettings(
  row: FreePlanSettings | null | undefined,
): FreePlanSettings {
  return row
    ? {
        photos: row.photos,
        renews: row.renews,
        autoRenews: row.autoRenews,
        videos: row.videos,
        otherAds: row.otherAds,
      }
    : { ...DEFAULT_FREE_PLAN };
}

/** Seed values for `free_plan_ad_limits`, by subcategory or category slug. */
export const DEFAULT_FREE_AD_CAPS: readonly {
  subcategorySlug?: string;
  categorySlug?: string;
  ads: number;
}[] = [
  { subcategorySlug: 'cars-for-sale', ads: 2 },
  { subcategorySlug: 'vehicles-for-rent', ads: 2 },
  { subcategorySlug: 'motorcycles-for-sale', ads: 2 },
  { categorySlug: 'fashion-and-beauty', ads: 50 },
  { categorySlug: 'foods', ads: 50 },
];

export const ENTITLEMENTS_QUEUE = 'entitlements';
export const LISTING_SWEEP_JOB = 'listing-restriction-sweep';
