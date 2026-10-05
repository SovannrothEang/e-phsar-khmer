/**
 * All Ads (`/[locale]/all-ads`) is the one feed surface with no category
 * scoping, so its query shape lives here rather than in the page.
 *
 * The param *names* below are owned by the shared filter components; they are
 * repeated as literals because those modules are `"use client"` and a server
 * component cannot read a value out of a client module. Keep them in step with
 * `MoreFilters.KEYWORD_PARAM` and `PriceFilter.MIN_AD_PRICE_PARAM` /
 * `MAX_AD_PRICE_PARAM`.
 */

/** Filter param names as the shared filter components write them. */
const KEYWORD_PARAM = "keyword";
const MIN_AD_PRICE_PARAM = "min_ad_price";
const MAX_AD_PRICE_PARAM = "max_ad_price";

/** The slug the homepage's Browse By Location links carry (`?province=`). */
export const PROVINCE_PARAM = "province";

/**
 * One screen of the grid: 24 cards is six full rows at the desktop 4-column
 * layout (twelve at two columns on mobile). The first screen also carries the
 * Sell card, and every later batch is appended to it — a batch is not a page.
 */
export const ALL_ADS_PAGE_SIZE = 24;

export interface AllAdsFilters {
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  provinceSlug?: string;
}

/**
 * The `?province=` slug comes from the homepage's Browse By Location, which
 * reads the mock `lib/location` list. That list agrees with the seeded
 * geography on 24 of its 25 provinces; `tboung-khmum` is the one spelling it
 * gets wrong (the DB row is `tbong-khmum`). The alias matters because an
 * unknown slug is not an error downstream — the feed short-circuits to an
 * empty list, which reads as "no ads here" rather than as a typo.
 */
const PROVINCE_SLUG_ALIASES: Record<string, string> = {
  "tboung-khmum": "tbong-khmum",
};

const PROVINCE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeProvinceSlug(raw: string | null): string | undefined {
  const slug = (raw ?? "").trim().toLowerCase();
  if (!PROVINCE_SLUG_RE.test(slug)) return undefined;
  return PROVINCE_SLUG_ALIASES[slug] ?? slug;
}

function parsePrice(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Read the All Ads filters off the URL. Shared by the page (first batch) and
 * its load-more action (every later batch) so both filter identically.
 */
export function parseAllAdsFilters(
  get: (key: string) => string | null,
): AllAdsFilters {
  const q = (get(KEYWORD_PARAM) ?? "").trim();
  return {
    q: q || undefined,
    minPrice: parsePrice(get(MIN_AD_PRICE_PARAM)),
    maxPrice: parsePrice(get(MAX_AD_PRICE_PARAM)),
    provinceSlug: normalizeProvinceSlug(get(PROVINCE_PARAM)),
  };
}
