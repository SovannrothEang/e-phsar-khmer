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
