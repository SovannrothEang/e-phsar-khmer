/**
 * All Ads (`/[locale]/all-ads`) is the one feed surface with no category
 * scoping. Its query shape is the shared feed vocabulary in
 * `lib/search-params.ts`, so the filter bar and every other feed page parse
 * the URL identically.
 */
import {
  LOCATION_PRO_PARAM,
  Q_PARAM,
  parseFeedParams,
  type FeedQuery,
} from "@/lib/search-params";

/**
 * One screen of the grid: 24 cards is six full rows at the desktop 4-column
 * layout (twelve at two columns on mobile). The first screen also carries the
 * Sell card, and every later batch is appended to it — a batch is not a page.
 */
export const ALL_ADS_PAGE_SIZE = 24;

/** The All Ads query is exactly the backend feed's filter set. */
export type AllAdsFilters = FeedQuery;

/**
 * Legacy aliases. Before the shared filter vocabulary existed the homepage
 * linked with `?province=<slug>` and the keyword was `?keyword=`; old links
 * and bookmarks still carry them. The homepage now writes `loc_pro`/`q`.
 *
 * The old mock homepage list also spelled one province `tboung-khmum`, while
 * the seeded row is `tbong-khmum`. An unknown slug is not an error downstream
 * — the feed short-circuits to empty — so normalize it here instead of
 * rendering "no ads here" for a typo.
 */
const LEGACY_PROVINCE_PARAM = "province";
const LEGACY_KEYWORD_PARAM = "keyword";
const PROVINCE_SLUG_ALIASES: Record<string, string> = {
  "tboung-khmum": "tbong-khmum",
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function normalizeProvinceSlug(raw: string | undefined): string | undefined {
  const slug = (raw ?? "").trim().toLowerCase();
  if (!slug) return undefined;
  return PROVINCE_SLUG_ALIASES[slug] ?? slug;
}

/**
 * Read the All Ads filters off the URL. Shared by the page (first batch) and
 * its load-more action (every later batch) so both filter identically.
 */
export function parseAllAdsFilters(searchParams: RawParams): AllAdsFilters {
  const params: RawParams = { ...searchParams };

  // A whitespace-only canonical param is absent, not a value — otherwise it
  // would suppress a valid legacy param.
  const q = first(params[Q_PARAM])?.trim();
  if (!q) {
    const keyword = first(params[LEGACY_KEYWORD_PARAM])?.trim();
    if (keyword) params[Q_PARAM] = keyword;
  }
  const pro = first(params[LOCATION_PRO_PARAM])?.trim();
  if (!pro) {
    const province = normalizeProvinceSlug(
      first(params[LEGACY_PROVINCE_PARAM]),
    );
    if (province) params[LOCATION_PRO_PARAM] = province;
  }

  return parseFeedParams(params);
}
