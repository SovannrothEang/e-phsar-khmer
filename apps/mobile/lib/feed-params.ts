import type { FeedQuery } from "@/lib/api/feed";

type ParamValue = string | string[] | undefined;

const FILTER_KEYS = [
  "sort",
  "postedWithin",
  "provinceSlug",
  "districtSlug",
  "communeSlug",
  "minPrice",
  "maxPrice",
  "condition",
  "yearMin",
  "yearMax",
  "brand",
  "attrs",
] as const;

/** The filter params a browse screen forwards to the filter screen for prefill. */
export function pickFilterParams(
  params: Record<string, ParamValue>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = firstParam(params[key]);
    if (value) result[key] = value;
  }
  return result;
}

export function firstParam(value: ParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The URL params the filter screen writes back onto a browse page, translated
 * into the public feed's query vocabulary. Empty and malformed values are
 * dropped, so a bad `attrs` JSON can never break a page.
 */
export function feedQueryFromParams(
  params: Record<string, ParamValue>,
): Omit<FeedQuery, "categorySlug" | "subcategorySlug"> {
  const get = (key: string): string | undefined => {
    const value = firstParam(params[key]);
    return value && value.trim() !== "" ? value : undefined;
  };

  const attrsRaw = get("attrs");
  let attrs: Record<string, string> | undefined;
  if (attrsRaw) {
    try {
      const parsed: unknown = JSON.parse(attrsRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        attrs = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(
            ([key, value]) => [key, String(value)],
          ),
        );
      }
    } catch {
      /* malformed attrs are ignored */
    }
  }

  return {
    sort: get("sort"),
    postedWithin: get("postedWithin"),
    provinceSlug: get("provinceSlug"),
    districtSlug: get("districtSlug"),
    communeSlug: get("communeSlug"),
    minPrice: get("minPrice"),
    maxPrice: get("maxPrice"),
    condition: get("condition"),
    yearMin: get("yearMin"),
    yearMax: get("yearMax"),
    brand: get("brand"),
    attrs,
  };
}
