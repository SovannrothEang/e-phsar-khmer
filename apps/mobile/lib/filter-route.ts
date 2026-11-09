import type { Href } from "expo-router";

/** The browse routes the filter screen knows how to return to. */
export type FilterReturnRoute =
  | "category"
  | "subcategory"
  | "brand"
  | "brandType"
  | "type"
  | "typeBrand"
  | "profile"
  | "searchPosts";

/** The route context a browse screen owns; Apply must not drop it. */
export interface FilterScope {
  categoryId?: string;
  subCategoryId?: string;
  brandId?: string;
  typeId?: string;
  /** Brand display name — the feed matches display names, never slugs. */
  brand?: string;
  attrKey?: string;
  attrValue?: string;
  /** "1" only for the brand -> bodytype drill-down on a type route. */
  brandScope?: string;
  userId?: string;
  username?: string;
}

const ROUTE_TEMPLATES: Record<
  Exclude<FilterReturnRoute, "profile" | "searchPosts">,
  string
> = {
  category: "/(categories)/[categoryId]",
  subcategory: "/(categories)/[categoryId]/[subCategoryId]",
  brand: "/(categories)/[categoryId]/[subCategoryId]/[brandId]",
  brandType: "/(categories)/[categoryId]/[subCategoryId]/[brandId]/[typeId]",
  type: "/(categories)/[categoryId]/[subCategoryId]/type/[typeId]",
  typeBrand:
    "/(categories)/[categoryId]/[subCategoryId]/type/[typeId]/[brandId]",
};

const RETURN_ROUTES: readonly FilterReturnRoute[] = [
  "category",
  "subcategory",
  "brand",
  "brandType",
  "type",
  "typeBrand",
  "profile",
  "searchPosts",
];

function isFilterReturnRoute(
  value: string | undefined,
): value is FilterReturnRoute {
  return !!value && RETURN_ROUTES.includes(value as FilterReturnRoute);
}

function compact(
  values: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  ) as Record<string, string>;
}

/** Scope params a browse route reads back from its own URL. */
function browseScope(scope: FilterScope): Record<string, string> {
  return compact({
    categoryId: scope.categoryId,
    subCategoryId: scope.subCategoryId,
    brandId: scope.brandId,
    typeId: scope.typeId,
    brand: scope.brand,
    attrKey: scope.attrKey,
    attrValue: scope.attrValue,
    brandScope: scope.brandScope,
  });
}

/** Fallback when a deep link reached /filters without a returnTo marker. */
export function inferReturnRoute(
  scope: FilterScope,
): FilterReturnRoute | undefined {
  const hasBase = !!scope.categoryId && !!scope.subCategoryId;
  if (scope.userId && scope.username) return "profile";
  if (hasBase && scope.typeId && scope.brandId) return "typeBrand";
  if (hasBase && scope.typeId) return "type";
  if (hasBase && scope.brandId) return "brand";
  if (hasBase) return "subcategory";
  if (scope.categoryId) return "category";
  return undefined;
}

/** A route href needs its dynamic segments; otherwise the literal [param]
 *  would reach dismissTo and warn instead of navigating. */
function hasRouteParams(route: FilterReturnRoute, scope: FilterScope): boolean {
  switch (route) {
    case "profile":
      return !!scope.userId && !!scope.username;
    case "category":
      return !!scope.categoryId;
    case "subcategory":
      return !!scope.categoryId && !!scope.subCategoryId;
    case "brand":
      return !!scope.categoryId && !!scope.subCategoryId && !!scope.brandId;
    case "brandType":
      return (
        !!scope.categoryId &&
        !!scope.subCategoryId &&
        !!scope.brandId &&
        !!scope.typeId
      );
    case "type":
      return !!scope.categoryId && !!scope.subCategoryId && !!scope.typeId;
    case "typeBrand":
      return (
        !!scope.categoryId &&
        !!scope.subCategoryId &&
        !!scope.typeId &&
        !!scope.brandId
      );
    case "searchPosts":
      return true;
  }
}

/**
 * The href `/filters` dismisses to on Apply. `dismissTo` replaces the target's
 * params instead of merging them, so every scope param must be passed along.
 * The pathname comes from a fixed table, never from a caller-supplied path.
 */
export function filterReturnHref(
  returnTo: string | undefined,
  scope: FilterScope,
  params: Record<string, string>,
): Href | null {
  const route = isFilterReturnRoute(returnTo)
    ? returnTo
    : inferReturnRoute(scope);
  if (!route || !hasRouteParams(route, scope)) return null;
  if (route === "searchPosts") {
    return { pathname: "/search-posts", params } as unknown as Href;
  }
  if (route === "profile") {
    if (!scope.username) return null;
    return {
      pathname: "/user/[id]",
      params: { id: scope.username, ...params },
    } as unknown as Href;
  }
  const merged = { ...browseScope(scope), ...params };
  if (route === "brand" || route === "brandType" || route === "typeBrand") {
    // The path segment already fixes the brand; a `brand` query param would
    // also make the chip badge count drill-down scope as a filter.
    delete merged.brand;
  }
  return {
    pathname: ROUTE_TEMPLATES[route],
    params: merged,
  } as unknown as Href;
}

/** The href a browse screen uses to open `/filters` with its route scope. */
export function openFiltersHref(
  returnTo: FilterReturnRoute,
  scope: FilterScope,
  params: Record<string, string> = {},
): Href {
  const routeParams =
    returnTo === "profile"
      ? compact({ userId: scope.userId, username: scope.username })
      : browseScope(scope);
  return {
    pathname: "/filters",
    // Route scope wins over a caller/deep-link filter of the same
    // key; the caller's filters fill everything the route does not own.
    params: { ...params, ...routeParams, returnTo },
  } as unknown as Href;
}
