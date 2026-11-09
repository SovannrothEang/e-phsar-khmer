import type { FeedQuery } from "@/lib/api/feed";

type ParamValue = string | string[] | undefined;

/** The URL-level filter params the filter screen pre-fills from a browse screen. */
const FILTER_KEYS = [
  "sort",
  "postedWithin",
  "provinceSlug",
  "districtSlug",
  "communeSlug",
  "minPrice",
  "maxPrice",
  "sizeMin",
  "sizeMax",
  "condition",
  "yearMin",
  "yearMax",
  "brand",
  "discount",
  "delivery",
  "attrs",
  "view",
] as const;

/** Values the backend will accept; anything else would be a 400. */
const SORT_VALUES = ["newest", "price_asc", "price_desc", "relevance"] as const;
const POSTED_WITHIN_VALUES = ["today", "week", "month"] as const;
const CONDITION_VALUES = ["new", "used"] as const;

/** Mirrors the backend's `parseAttributeFilters` bounds. */
const ATTR_KEY_RE = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const MAX_ATTRS = 12;
const MAX_ATTR_VALUE = 120;
const MAX_ATTRS_JSON = 2000;
/**
 * Discount and free delivery are listing columns, never `attributes` keys.
 * Older mobile URLs carried them in `attrs`; they must not be forwarded.
 */
const COLUMN_ATTR_KEYS = new Set(["discount", "deliveryFree"]);

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

function getString(
  params: Record<string, ParamValue>,
  key: string,
): string | undefined {
  const value = firstParam(params[key])?.trim();
  return value ? value : undefined;
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}

function nonNegativeNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function yearNumber(value: string | undefined): number | undefined {
  if (!value || !/^\d{4}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed >= 1900 && parsed <= 2100 ? parsed : undefined;
}

function orderedRange(
  min: number | undefined,
  max: number | undefined,
): [number | undefined, number | undefined] {
  // Web swaps an inverted range instead of surfacing an error; the backend
  // rejects min > max with a 400.
  if (min != null && max != null && min > max) return [max, min];
  return [min, max];
}

function isOn(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function normalizeRange(
  min: string,
  max: string,
  parse: (value: string | undefined) => number | undefined,
): { min?: string; max?: string } {
  const [low, high] = orderedRange(parse(min.trim()), parse(max.trim()));
  return {
    ...(low != null ? { min: String(low) } : {}),
    ...(high != null ? { max: String(high) } : {}),
  };
}

/** Corrects the filter screen's price inputs before they become URL params. */
export function normalizePriceRange(
  min: string,
  max: string,
): { min?: string; max?: string } {
  return normalizeRange(min, max, nonNegativeNumber);
}

/** Corrects the filter screen's size inputs before they become URL params. */
export function normalizeSizeRange(
  min: string,
  max: string,
): { min?: string; max?: string } {
  return normalizeRange(min, max, nonNegativeNumber);
}

/** Corrects the year pickers before they become URL params. */
export function normalizeYearRange(
  min: string,
  max: string,
): { min?: string; max?: string } {
  return normalizeRange(min, max, yearNumber);
}

/** The filter screen's editor view of `attrs`, validated like the feed. */
export function parseAttrsInput(raw: string): Record<string, string> {
  return parseAttrsParam(raw) ?? {};
}

/** Caps and sanitizes a merged attribute map (route attr + URL filters). */
export function sanitizeAttrs(
  attrs: Record<string, string>,
): Record<string, string> {
  return parseAttrsParam(JSON.stringify(attrs)) ?? {};
}

function parseAttrsParam(
  raw: string | undefined,
): Record<string, string> | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (!ATTR_KEY_RE.test(key) || COLUMN_ATTR_KEYS.has(key)) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    const text = String(value).trim();
    if (!text || text.length > MAX_ATTR_VALUE) continue;
    entries.push([key, text]);
    if (entries.length >= MAX_ATTRS) break;
  }

  // The DTO rejects a serialized `attrs` over 2000 characters.
  while (
    entries.length > 0 &&
    JSON.stringify(Object.fromEntries(entries)).length > MAX_ATTRS_JSON
  ) {
    entries.pop();
  }

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * The URL params the filter screen writes back onto a browse page, translated
 * into the public feed's query vocabulary. Empty, malformed and client-only
 * values are dropped, so a bad deep link can never produce a 400.
 */
export function feedQueryFromParams(
  params: Record<string, ParamValue>,
): Omit<FeedQuery, "categorySlug" | "subcategorySlug"> {
  const provinceSlug = getString(params, "provinceSlug");
  // A child location without its parent is ignored by the backend; drop it
  // here so the query key reflects what will actually be filtered.
  const districtSlug = provinceSlug
    ? getString(params, "districtSlug")
    : undefined;
  const communeSlug = districtSlug
    ? getString(params, "communeSlug")
    : undefined;

  const [minPrice, maxPrice] = orderedRange(
    nonNegativeNumber(getString(params, "minPrice")),
    nonNegativeNumber(getString(params, "maxPrice")),
  );
  const [sizeMin, sizeMax] = orderedRange(
    nonNegativeNumber(getString(params, "sizeMin")),
    nonNegativeNumber(getString(params, "sizeMax")),
  );
  const [yearMin, yearMax] = orderedRange(
    yearNumber(getString(params, "yearMin")),
    yearNumber(getString(params, "yearMax")),
  );

  const discount = isOn(getString(params, "discount"));
  const deliveryFree = isOn(getString(params, "delivery"));

  return {
    sort: oneOf(getString(params, "sort"), SORT_VALUES),
    postedWithin: oneOf(
      getString(params, "postedWithin"),
      POSTED_WITHIN_VALUES,
    ),
    provinceSlug,
    districtSlug,
    communeSlug,
    minPrice: minPrice != null ? String(minPrice) : undefined,
    maxPrice: maxPrice != null ? String(maxPrice) : undefined,
    sizeMin: sizeMin != null ? String(sizeMin) : undefined,
    sizeMax: sizeMax != null ? String(sizeMax) : undefined,
    condition: oneOf(getString(params, "condition"), CONDITION_VALUES),
    yearMin: yearMin != null ? String(yearMin) : undefined,
    yearMax: yearMax != null ? String(yearMax) : undefined,
    brand: getString(params, "brand"),
    hasDiscount: discount || undefined,
    deliveryFree: deliveryFree || undefined,
    attrs: parseAttrsParam(getString(params, "attrs")),
  };
}

/**
 * One badge definition for every browse surface: one per active filter row.
 * Drill-down scope (the brand path) is not a filter and is not counted — but
 * the Jobs Category row is, so a jobs subcategory counts as its own filter.
 */
export function countActiveFilters(
  params: Record<string, ParamValue>,
  options?: { brandIsScope?: boolean },
): number {
  const query = feedQueryFromParams(params);
  const attrs = query.attrs ?? {};
  let count = 0;
  // The Jobs filter screen's Category row switches the job subcategory, so the
  // route's subcategory is a chosen filter there, not drill-down scope.
  if (
    getString(params, "categoryId") === "jobs" &&
    getString(params, "subCategoryId")
  ) {
    count += 1;
  }
  if (query.postedWithin) count += 1;
  if (query.provinceSlug) count += 1;
  if (query.minPrice) count += 1;
  if (query.maxPrice) count += 1;
  if (query.sizeMin) count += 1;
  if (query.sizeMax) count += 1;
  if (query.yearMin || query.yearMax) count += 1;
  if (query.condition) count += 1;
  if (query.brand && !options?.brandIsScope) count += 1;
  // A brand reached by tapping a brand tile is a path scope (brandId) or a
  // brand->type query scope; the user still chose it, so it counts once.
  if (
    options?.brandIsScope &&
    (getString(params, "brandId") || getString(params, "brand"))
  ) {
    count += 1;
  }
  if (query.hasDiscount) count += 1;
  if (query.deliveryFree) count += 1;
  // One count per attribute row (Model, Job Type, Experience, …), so two
  // chosen specs read as two active filters.
  count += Object.keys(attrs).length;
  // A tile selection arrives as attrKey/attrValue (e.g. bodyType or network)
  // until the filter screen writes it into attrs; count it exactly once.
  const routeAttrKey = getString(params, "attrKey");
  const routeAttrValue = getString(params, "attrValue");
  if (routeAttrKey && routeAttrValue && attrs[routeAttrKey] === undefined) {
    count += 1;
  }
  if (query.sort && query.sort !== "newest") count += 1;
  return count;
}
