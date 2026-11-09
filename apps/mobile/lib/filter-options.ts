/** The sort picker's options — shared by the filter screen and the feed chip. */
export interface FilterOption {
  id: string;
  name: string;
}

export const SORT_OPTIONS: FilterOption[] = [
  { id: "newest", name: "Latest Ads" },
  { id: "price_asc", name: "Price: Low to High" },
  { id: "price_desc", name: "Price: High to Low" },
];

/** Listing condition, shared by the filter screen and the feed chip. */
export const CONDITION_OPTIONS: FilterOption[] = [
  { id: "new", name: "New" },
  { id: "used", name: "Used" },
];

/**
 * Categories whose post schema has no price: the Services forms collect only
 * title/description/location/contact, so the feed offers no price filter.
 */
export const NO_PRICE_CATEGORIES = new Set(["services"]);

/**
 * Furniture children whose Type rows carry no artwork: the tile strip would
 * render as bare initials (the captain's "D / G / K" mock), so Type lives only
 * in the Filters page and the quick-filter chip, with a compact searchless
 * sheet. Every other subcategory keeps its Type tile grid.
 */
export const TYPE_IN_FILTERS_ONLY_SUBCATEGORIES = new Set([
  "table-and-desks",
  "chairs-and-sofas",
]);
