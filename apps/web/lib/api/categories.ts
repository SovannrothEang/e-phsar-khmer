import "server-only";
import { API_URL } from "@/lib/api/client";
import type { RealDetailData } from "@/components/post/Post-Detail";
import type { Post } from "@/lib/posts";
import type { User } from "@/lib/user";
import { applyDiscount } from "@/lib/utils";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Preview-visible seller identity from the listing's own contact fields —
 * `GET /users/:id` is JWT-protected, so there is no anonymous seller profile.
 */
function toSellerView(l: BackendListing): User {
  const name = l.contactName && l.contactName.trim() ? l.contactName : "Seller";
  const username = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return {
    userId: l.userId,
    username,
    name,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a0e9&color=fff`,
    cover: "",
    locations: "",
    following: 0,
    follower: 0,
    joinDate: new Date(l.createdAt).toISOString(),
    phone: l.contactPhones,
    email: l.contactEmail ?? undefined,
    userlink: `@${username}`,
  };
}

/**
 * Build the template's `RealDetailData` for a real listing — shared by the
 * two detail entry points (`[slug]` root-slug and `post/[slug]`). Returns
 * null when the id is unknown (caller falls back to the mock render).
 */
export async function buildRealDetailData(
  id: string,
  locale: string,
): Promise<RealDetailData | null> {
  const [listing, allCategories] = await Promise.all([
    getListingById(id, locale),
    getAllCategories(locale),
  ]);
  if (!listing) return null;

  const cate = allCategories?.find((c) => c.id === listing.categoryId);
  const sub = cate?.subcategories.find((s) => s.id === listing.subcategoryId);
  const attributes = listing.attributes ?? {};
  const toBreadcrumb = (key: string) => {
    const raw = attributes[key];
    if (raw === undefined || raw === null || raw === "") return undefined;
    const name = String(raw);
    return { slug: slugify(name), name };
  };

  return {
    listing,
    cate: cate ? { slug: cate.slug, name: cate.name } : undefined,
    subcate: sub ? { slug: sub.slug, name: sub.name } : undefined,
    brand: toBreadcrumb("brand"),
    model: toBreadcrumb("model"),
    seller: toSellerView(listing),
  };
}

/**
 * Backend shapes for the category/subcategory pages (subset of the fields the
 * pages render) — the web app is standalone, so these are local types, never
 * backend DTO imports. Mirrors the CategoryGrid pattern: raw fetch, no-store,
 * Accept-Language header, envelope unwrap, null/[] on failure.
 */

export interface BackendCategory {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  subcategories: BackendSubcategory[];
}

export interface BackendSubcategory {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
}

export interface BackendBrand {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
}

export interface BackendModel {
  id: string;
  slug: string;
  name: string;
}

export interface BackendAttributeRow {
  type?: string;
  slug: string;
  name: string;
  image: string | null;
  subcategoryIds: string[];
}

export interface BackendListingPhoto {
  url: string;
  path: string;
  sort: number;
}

/** Subset of the backend `GET /listings/:id` row the detail page renders. */
export interface BackendListing {
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
  deliveryFree: boolean;
  contactName: string | null;
  contactPhones: string[];
  contactEmail: string | null;
  status: string;
  viewsCount: number;
  publishedAt: string | null;
  createdAt: string;
  photos: BackendListingPhoto[];
}

interface Envelope<T> {
  success: boolean;
  data?: T;
}

async function getJson<T>(path: string, locale: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { "Accept-Language": locale },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Envelope<T>;
    return body.success ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

export async function getCategoryWithSubcategories(
  slug: string,
  locale: string,
): Promise<BackendCategory | null> {
  return getJson<BackendCategory>(`/categories/${slug}`, locale);
}

export async function getBrandsForSubcategory(
  subcategorySlug: string,
): Promise<BackendBrand[]> {
  return (
    (await getJson<BackendBrand[]>(
      `/brands?subcategory=${encodeURIComponent(subcategorySlug)}`,
      "en",
    )) ?? []
  );
}

export async function getBodyTypes(): Promise<BackendAttributeRow[]> {
  return (
    (await getJson<BackendAttributeRow[]>("/attributes/bodytypes", "en")) ?? []
  );
}

/** Any attribute set (bodytypes, types, bedrooms, …) — rows carry the
 *  denormalized subcategoryIds (UUIDs) consumed by the subcategory pages. */
export async function getAttributeOptions(
  type: string,
): Promise<BackendAttributeRow[]> {
  return (
    (await getJson<BackendAttributeRow[]>(
      `/attributes/${encodeURIComponent(type)}`,
      "en",
    )) ?? []
  );
}

/** One call for every attribute row linked to a subcategory — the browse
 *  pages use this instead of per-type fetches. */
export async function getLinkedAttributeOptions(
  subcategoryId: string,
): Promise<BackendAttributeRow[]> {
  return (
    (await getJson<BackendAttributeRow[]>(
      `/attributes?subcategoryId=${encodeURIComponent(subcategoryId)}`,
      "en",
    )) ?? []
  );
}

export async function getModelsForBrand(
  brandId: string,
): Promise<BackendModel[]> {
  return (
    (await getJson<BackendModel[]>(`/brands/${brandId}/models`, "en")) ?? []
  );
}

export async function getListingById(
  id: string,
  locale: string,
): Promise<BackendListing | null> {
  return getJson<BackendListing>(`/listings/${id}`, locale);
}

export async function getAllCategories(
  locale: string,
): Promise<BackendCategory[] | null> {
  return getJson<BackendCategory[]>("/categories", locale);
}

export interface ListingsFeed {
  items: BackendListing[];
  nextCursor: string | null;
}

/** Public active-listings feed (cursor pagination is exposed, not consumed here). */
export async function getListingsFeed(
  params: {
    categorySlug?: string;
    subcategorySlug?: string;
    brand?: string;
    bodyType?: string;
    limit?: number;
  },
  locale: string,
): Promise<ListingsFeed | null> {
  const qs = new URLSearchParams();
  if (params.categorySlug) qs.set("categorySlug", params.categorySlug);
  if (params.subcategorySlug) qs.set("subcategorySlug", params.subcategorySlug);
  if (params.brand) qs.set("brand", params.brand);
  if (params.bodyType) qs.set("bodyType", params.bodyType);
  qs.set("limit", String(params.limit ?? 20));
  try {
    const res = await fetch(`${API_URL}/listings?${qs.toString()}`, {
      headers: { "Accept-Language": locale },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      success: boolean;
      data?: BackendListing[];
      meta?: { nextCursor: string | null };
    };
    if (!body.success) return null;
    return {
      items: body.data ?? [],
      nextCursor: body.meta?.nextCursor ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Adapt a backend feed listing into the local `Post` shape the existing
 * card components render (`GridCardPost`/`ListCardPost`). Runs server-side —
 * the cards receive plain serializable data.
 */
export function toCardPost(l: BackendListing): Post {
  const price = l.price !== null ? Number(l.price) : 0;
  return {
    postId: l.id,
    userId: l.userId,
    title: l.title,
    images: l.photos.map((p) => p.url),
    // The listing price is the ORIGINAL; the discount applies on top — the
    // bold price is the final, the strikethrough is the original, and the
    // %-OFF / $-OFF badges derive from oldPrice − price.
    price: applyDiscount(
      Number.isFinite(price) ? price : 0,
      l.discountValue,
      l.discountType,
    ),
    cateId: "",
    subId: "",
    description: l.description ?? "",
    createdat: new Date(l.createdAt),
    proId: "",
    disId: "",
    condition:
      l.condition === "used" ? "Used" : l.condition === "new" ? "New" : "",
    freeDelivery: l.deliveryFree,
    location: [l.location, l.address].filter(Boolean).join(", ") || undefined,
    oldPrice:
      l.discountValue && l.discountType
        ? Number.isFinite(price)
          ? price
          : 0
        : undefined,
  };
}

export async function getYears(): Promise<BackendAttributeRow[]> {
  return (
    (await getJson<BackendAttributeRow[]>("/attributes/years", "en")) ?? []
  );
}

export async function getColors(): Promise<BackendAttributeRow[]> {
  return (
    (await getJson<BackendAttributeRow[]>("/attributes/colors", "en")) ?? []
  );
}
