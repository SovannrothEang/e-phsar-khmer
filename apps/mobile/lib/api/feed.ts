import { apiFetch } from "@/lib/api/client";
import type { ListingDetail } from "@/lib/api/listings";

/** The public feed params web already uses — keep the vocabulary identical. */
export interface FeedQuery {
  categorySlug?: string;
  subcategorySlug?: string;
  provinceSlug?: string;
  districtSlug?: string;
  communeSlug?: string;
  q?: string;
  minPrice?: string;
  maxPrice?: string;
  condition?: string;
  yearMin?: string;
  yearMax?: string;
  brand?: string;
  bodyType?: string;
  attrKey?: string;
  attrValue?: string;
  attrs?: Record<string, string>;
  sort?: string;
  postedWithin?: string;
  userId?: string;
  limit?: number;
  cursor?: string;
  includeTotal?: boolean;
}

export interface FeedPage {
  items: ListingDetail[];
  nextCursor: string | null;
  total?: number;
}

/** Home's engagement-ranked strip; the backend fills the tail with new ads. */
export async function fetchTrending(limit = 10): Promise<ListingDetail[]> {
  const { data } = await apiFetch<ListingDetail[]>(
    `/listings/trending?limit=${encodeURIComponent(String(limit))}`,
    { auth: false },
  );
  return data ?? [];
}

export async function fetchFeed(query: FeedQuery): Promise<FeedPage> {
  const search = new URLSearchParams();
  const { attrs, limit, ...rest } = query;

  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  if (attrs && Object.keys(attrs).length > 0) {
    search.set("attrs", JSON.stringify(attrs));
  }
  search.set("limit", String(limit ?? 20));

  const { data, meta } = await apiFetch<ListingDetail[]>(
    `/listings?${search.toString()}`,
    { auth: false },
  );

  return {
    items: data ?? [],
    nextCursor: (meta?.nextCursor as string | null | undefined) ?? null,
    total: meta?.total as number | undefined,
  };
}
