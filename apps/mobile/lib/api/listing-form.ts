import { apiFetch } from "@/lib/api/client";

export interface ProductOption {
  id: string;
  modelId: string;
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  image: string | null;
}

export interface EntitlementsView {
  plan: "free" | "premium";
  limits: {
    photos: number;
    ads: number;
    renews: number;
    autoRenews: number;
    videos: number;
  };
  usage: { ads: number; renews: number; hidden: number };
  bucket: { key: string; name: string } | null;
}

export interface SignedListingUpload {
  signedUrl: string;
  path: string;
  token: string;
  publicUrl: string;
}

export interface CreateListingPayload {
  categoryId: string;
  subcategoryId: string;
  title: string;
  description?: string;
  price?: number;
  discountValue?: number;
  discountType?: "percent" | "amount";
  condition?: "new" | "used";
  photos?: { url: string; path: string; sort: number }[];
  attributes?: Record<string, unknown>;
  location?: string;
  address?: string;
  provinceId?: string;
  districtId?: string;
  communeId?: string;
  latitude?: number;
  longitude?: number;
  productModelId?: string;
  deliveryFree?: boolean;
  contactName?: string;
  contactPhones?: string[];
  contactEmail?: string;
}

/** Trusted spec picker rows (`GET /products?family=`). */
export async function fetchProducts(
  family: string,
  limit = 200,
): Promise<ProductOption[]> {
  const { data } = await apiFetch<ProductOption[]>(
    `/products?family=${encodeURIComponent(family)}&limit=${limit}`,
    { auth: false },
  );
  return data ?? [];
}

/**
 * The posting bucket for this subcategory: its `limits`/`usage` are the
 * pool and cap that apply. A failed read simply skips the client pre-check;
 * the backend still enforces the allowance.
 */
export async function fetchEntitlements(
  subcategoryId: string,
): Promise<EntitlementsView | null> {
  try {
    const { data } = await apiFetch<EntitlementsView>(
      `/subscriptions/entitlements?subcategoryId=${encodeURIComponent(subcategoryId)}`,
    );
    return data;
  } catch {
    return null;
  }
}

export async function signListingUpload(
  filename: string,
): Promise<SignedListingUpload> {
  const { data } = await apiFetch<SignedListingUpload>("/files/sign", {
    method: "POST",
    body: { scope: "listing", filename },
  });
  return data;
}

export async function createListing(
  payload: CreateListingPayload,
  idempotencyKey: string,
): Promise<{ id: string }> {
  const { data } = await apiFetch<{ id: string }>("/listings", {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return data;
}

export async function publishListing(id: string): Promise<void> {
  await apiFetch<unknown>(`/listings/${encodeURIComponent(id)}/publish`, {
    method: "POST",
  });
}

export async function deleteListing(id: string): Promise<void> {
  await apiFetch<unknown>(`/listings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
