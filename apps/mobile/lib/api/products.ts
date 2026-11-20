import { apiFetch } from "@/lib/api/client";

/** The five spec-page families (mirrors the backend enum). */
export type ProductSpecFamily =
  | "car"
  | "motorcycle"
  | "phone"
  | "tablet"
  | "smartwatch";

/** One label/value row inside a spec section. */
export interface ProductSpecRow {
  label: string;
  value: string;
}

/** A named section ("Display", "Camera", …); array order is display order. */
export interface ProductSpecGroup {
  title: string;
  rows: ProductSpecRow[];
}

/**
 * Subset of `GET /products/:brandSlug/:modelSlug` the spec screen renders.
 * Mirrors web's `ProductDetail`; the app is standalone, so the type is local
 * rather than imported. `image` is the backend's coalesce of the staff spec
 * image and the model image (null when neither exists).
 */
export interface ProductSpecDetail {
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  family: ProductSpecFamily;
  image: string | null;
  specImage: string | null;
  specGroups: ProductSpecGroup[];
}

/**
 * Public spec page. 404s (as ApiError) for an unknown slug, an unpublished
 * page, or an inactive brand/model — the spec screen renders its not-found
 * state. The listing chip is gated on the embedded `product` ref and never
 * calls this function.
 */
export async function fetchProductSpec(
  brandSlug: string,
  modelSlug: string,
): Promise<ProductSpecDetail> {
  const { data } = await apiFetch<ProductSpecDetail>(
    `/products/${encodeURIComponent(brandSlug)}/${encodeURIComponent(modelSlug)}`,
    { auth: false },
  );
  return data;
}

/** One row of the public published-spec list (`GET /products`). */
export interface ProductSummary {
  id: string;
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  image: string | null;
}

/**
 * Published spec pages matching a keyword over brand/model names and slugs.
 * Public and auth-free; the backend caps `q` at 100 chars and `limit` at 200.
 */
export async function fetchProducts(
  q: string,
  limit = 3,
): Promise<ProductSummary[]> {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  const { data } = await apiFetch<ProductSummary[]>(
    `/products?${qs.toString()}`,
    { auth: false },
  );
  return data ?? [];
}
