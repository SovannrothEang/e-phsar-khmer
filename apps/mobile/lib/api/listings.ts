import { apiFetch } from "@/lib/api/client";

export interface ListingPhoto {
  url: string;
  path: string;
  sort: number;
}

export interface ListingProductRef {
  modelId: string;
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
}

/** Subset of `GET /listings/:id` the detail screen renders. */
export interface ListingDetail {
  id: string;
  userId: string;
  categoryId: string;
  subcategoryId: string;
  title: string;
  description: string | null;
  price: string | null;
  currency: string | null;
  discountValue: string | null;
  discountType: "percent" | "amount" | null;
  condition: "new" | "used" | null;
  attributes: Record<string, unknown> | null;
  location: string | null;
  address: string | null;
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
  latitude: string | null;
  longitude: string | null;
  deliveryFree: boolean;
  contactName: string | null;
  contactPhones: string[];
  contactEmail: string | null;
  sellerUsername?: string | null;
  sellerVerifiedAccount?: boolean;
  likeCount?: number | null;
  productModelId?: string | null;
  product?: ListingProductRef | null;
  status: string;
  viewsCount: number;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  photos: ListingPhoto[];
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  subcategories?: {
    id: string;
    slug: string;
    name: string;
    icon: string | null;
  }[];
}

/** Public detail read. 404s (as ApiError) for draft/deleted/unknown ids. */
export async function fetchListing(id: string): Promise<ListingDetail> {
  const { data } = await apiFetch<ListingDetail>(
    `/listings/${encodeURIComponent(id)}`,
    { auth: false },
  );
  return data;
}

/** Public category tree — used for the detail's category/subcategory names. */
export async function fetchCategories(): Promise<CategoryNode[]> {
  const { data } = await apiFetch<CategoryNode[]>("/categories", {
    auth: false,
  });
  return data ?? [];
}

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
}

/**
 * Nearest live ads around a point. The device fix travels only in this
 * request; nothing stores it. The backend redacts it from the HTTP log.
 */
export async function fetchNearby(
  query: NearbyQuery,
): Promise<ListingDetail[]> {
  const search = new URLSearchParams({
    lat: String(query.lat),
    lng: String(query.lng),
    radiusKm: String(query.radiusKm ?? 10),
    limit: String(query.limit ?? 8),
  });
  const { data } = await apiFetch<ListingDetail[]>(
    `/listings/nearby?${search.toString()}`,
    { auth: false },
  );
  return data ?? [];
}
