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
