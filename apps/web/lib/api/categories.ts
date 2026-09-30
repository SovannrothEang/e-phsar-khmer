import "server-only";
import { API_URL } from "@/lib/api/client";
import type { RealDetailData } from "@/components/post/Post-Detail";
import type { Post } from "@/lib/posts";
import type { User } from "@/lib/user";
import { applyDiscount } from "@/lib/utils";
import type { FeedQuery } from "@/lib/search-params";

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
  // The jobs form's `company` rides in `attributes` (it is not a contact
  // column). It shows on the seller card, never in the specs grid.
  const rawCompany = l.attributes?.company;
  const company =
    typeof rawCompany === "string" && rawCompany.trim()
      ? rawCompany.trim()
      : undefined;
  return {
    userId: l.userId,
    username,
    name,
    company,
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

/** One listing-form field the backend declares for a subcategory (`field_schema`). */
export interface BackendFieldDef {
  key: string;
  type: string;
  required?: boolean;
  max?: number;
  options?: string[];
  /** Localized display name; `en` is always present, `km`/`zh` may not be yet. */
  label?: { en?: string; km?: string; zh?: string };
}

export interface BackendSubcategory {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  /** Which listing-form blocks this subcategory has; absent on older rows. */
  fieldSchema?: BackendFieldDef[] | null;
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
  /** Drizzle returns numeric columns as strings; parse before use. */
  latitude: string | null;
  longitude: string | null;
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

/**
 * A brand's models, optionally narrowed to one subcategory.
 *
 * The subcategory matters: models carry their own subcategory links, so
 * without it the Tablets page under Apple would offer iPhones. Pass the
 * subcategory the caller is actually rendering for.
 */
export async function getModelsForBrand(
  brandId: string,
  subcategorySlug?: string,
): Promise<BackendModel[]> {
  const query = subcategorySlug
    ? `?subcategory=${encodeURIComponent(subcategorySlug)}`
    : "";
  return (
    (await getJson<BackendModel[]>(
      `/brands/${brandId}/models${query}`,
      "en",
    )) ?? []
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

export interface FeedFacet {
  slug: string;
  count: number;
}

export interface ListingsFeed {
  items: BackendListing[];
  nextCursor: string | null;
  /** Only when requested with `includeTotal`. */
  total?: number;
  /** Only when requested with `includeFacets`. */
  facets?: { categories: FeedFacet[]; subcategories?: FeedFacet[] };
}

export interface ListingsFeedParams extends FeedQuery {
  brand?: string;
  bodyType?: string;
  /**
   * Generic attribute filter — the key the *subcategory's own schema* uses
   * for the clicked grid (see `resolveAttrKey` in the subcategory page).
   * `bodyType` above is only right for cars/lorries; every other grid stores
   * its value under its own key (`type`, `vehicleType`, `accessory`, …).
   */
  attrKey?: string;
  attrValue?: string;
  limit?: number;
  cursor?: string;
  includeTotal?: boolean;
  includeFacets?: boolean;
}

/**
 * Public active-listings feed. Every defined param is forwarded as-is — the
 * URL-side validation lives in `parseFeedParams` (lib/search-params.ts).
 */
export async function getListingsFeed(
  params: ListingsFeedParams,
  locale: string,
): Promise<ListingsFeed | null> {
  const qs = new URLSearchParams();
  const { attrKey, attrValue, limit, ...rest } = params;
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === "" || value === false) continue;
    qs.set(key, String(value));
  }
  if (attrKey && attrValue) {
    qs.set("attrKey", attrKey);
    qs.set("attrValue", attrValue);
  }
  qs.set("limit", String(limit ?? 20));
  try {
    const res = await fetch(`${API_URL}/listings?${qs.toString()}`, {
      headers: { "Accept-Language": locale },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      success: boolean;
      data?: BackendListing[];
      meta?: {
        nextCursor: string | null;
        total?: number;
        facets?: ListingsFeed["facets"];
      };
    };
    if (!body.success) return null;
    return {
      items: body.data ?? [],
      nextCursor: body.meta?.nextCursor ?? null,
      total: body.meta?.total,
      facets: body.meta?.facets,
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
  // A null price is a real state, not zero — it means the subcategory has no
  // price field at all (Properties Wanted / Agent Services / Others). Keep it
  // null so the card can print "Negotiable" instead of a fabricated $0.
  const price =
    l.price !== null && Number.isFinite(Number(l.price))
      ? Number(l.price)
      : null;
  return {
    postId: l.id,
    userId: l.userId,
    title: l.title,
    images: l.photos.map((p) => p.url),
    // The listing price is the ORIGINAL; the discount applies on top — the
    // bold price is the final, the strikethrough is the original, and the
    // %-OFF / $-OFF badges derive from oldPrice − price.
    price:
      price === null
        ? null
        : applyDiscount(price, l.discountValue, l.discountType),
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
      price !== null && l.discountValue && l.discountType ? price : undefined,
  };
}

/** Public lookup rows for the post form's Location cascade. */
export interface BackendPlace {
  id: string;
  name: string;
  slug: string;
}

export async function getProvinces(): Promise<BackendPlace[]> {
  return (await getJson<BackendPlace[]>("/locations/provinces", "en")) ?? [];
}

export async function getDistricts(
  provinceSlug: string,
): Promise<BackendPlace[]> {
  return (
    (await getJson<BackendPlace[]>(
      `/locations/provinces/${encodeURIComponent(provinceSlug)}/districts`,
      "en",
    )) ?? []
  );
}

export async function getCommunes(
  provinceSlug: string,
  districtSlug: string,
): Promise<BackendPlace[]> {
  return (
    (await getJson<BackendPlace[]>(
      `/locations/provinces/${encodeURIComponent(provinceSlug)}/districts/${encodeURIComponent(districtSlug)}/communes`,
      "en",
    )) ?? []
  );
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

// `getVehicleTypes()` was removed 2026-09-16. The duplicate `vehicletypes`
// attribute set is retired in favour of `bodytypes`, so there is no second
// "kind of vehicle" list: Vehicles For Rent's Vehicle Type field now reads
// `getBodyTypes()` and therefore follows the admin's Body Type ticks.
