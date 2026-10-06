import "server-only";
import { API_URL } from "@/lib/api/client";
import { displayName, getPublicProfile } from "@/lib/api/users";
import type { RealDetailData } from "@/components/post/Post-Detail";
import type { Post } from "@/lib/posts";
import type { User } from "@/lib/user";
import { applyDiscount, shortLocation } from "@/lib/utils";
import type { FeedQuery } from "@/lib/search-params";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * The seller card's identity.
 *
 * The listing carries the owner's handle, so the card can resolve their real
 * public profile (`GET /users/by-username/:username` — the one anonymous
 * seller read; `GET /users/:id` is JWT-protected) and show it. Without that it
 * drew a *placeholder* identity that read as a profile but was not one: a
 * generated `ui-avatars` circle instead of the photo the seller had uploaded,
 * and the **listing's** `createdAt` under a "Members Since" label — so a
 * seller who joined in August appeared to have joined when they posted the ad.
 *
 * The contact fields stay per-ad: `contactPhones`/`contactEmail` are the
 * numbers the poster chose for *this* listing, and `company` rides in
 * `attributes` (it is not a contact column). It shows on the seller card, never
 * in the specs grid.
 */
async function toSellerView(l: BackendListing): Promise<User> {
  const username = l.sellerUsername ?? "";
  const profile = username ? await getPublicProfile(username) : null;

  // The ad's own contact name still leads — it is what the poster chose to be
  // called on this listing. The account's name is the fallback.
  const contactName =
    l.contactName && l.contactName.trim() ? l.contactName.trim() : null;
  const name = contactName ?? (profile ? displayName(profile) : "Seller");

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
    // The uploaded photo when there is one; the generated circle is a fallback
    // for an account with none, not a stand-in for a photo that exists.
    avatar:
      profile?.profilePhotoUrl ??
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a0e9&color=fff`,
    cover: profile?.coverPhotoUrl ?? "",
    locations: "",
    following: profile?.following ?? 0,
    follower: profile?.followers ?? 0,
    // The account's join date, never the listing's.
    joinDate: profile?.createdAt ?? new Date(l.createdAt).toISOString(),
    phone: l.contactPhones,
    email: l.contactEmail ?? undefined,
    userlink: username ? `@${username}` : undefined,
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
    seller: await toSellerView(listing),
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
  /**
   * The owner's handle, joined on by `GET /listings/:id`. Absent from feed
   * rows (they do not join `users`) and null when the owner is gone.
   */
  sellerUsername?: string | null;
  /**
   * How many users liked this listing — joined on by `GET /listings/:id`,
   * absent from feed rows. Drives the detail page's "N Likes" control.
   */
  likeCount?: number | null;
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

/**
 * The whole active category tree — or, with `userId`, only the categories that
 * seller has an active listing in, each carrying only the subcategories they
 * posted in under it (the profile's drill-down, both levels). Scoping here
 * rather than in a second endpoint keeps the translated-name resolution in the
 * one service that already owns it.
 */
export async function getAllCategories(
  locale: string,
  userId?: string,
): Promise<BackendCategory[] | null> {
  return getJson<BackendCategory[]>(
    `/categories${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`,
    locale,
  );
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
  /** Nothing matched exactly; these are typo-tolerant (similar) results. */
  fuzzy?: boolean;
}

export interface ListingsFeedParams extends FeedQuery {
  userId?: string;
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
        fuzzy?: boolean;
      };
    };
    if (!body.success) return null;
    return {
      items: body.data ?? [],
      nextCursor: body.meta?.nextCursor ?? null,
      total: body.meta?.total,
      facets: body.meta?.facets,
      fuzzy: body.meta?.fuzzy === true,
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
    // Carried so the card's "…" menu can offer View Profile — it used to look
    // the seller up in mock data by id, which never hit for a real listing, so
    // the control silently did nothing.
    sellerUsername: l.sellerUsername ?? null,
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
    // The card shows the design's short `district, province` — the commune and
    // the street address belong to the detail page (see `shortLocation`).
    location: shortLocation(l.location),
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

/** A user's saved location, as the post form's place picker expects it. */
export interface UserPlaceSelection {
  province: BackendPlace | null;
  district: BackendPlace | null;
  commune: BackendPlace | null;
}

/**
 * Rebuilds the Location cascade from the ids stored on a user row. The lookup
 * endpoints are slug-keyed, so each level is found by walking down from the
 * province list — at most two extra calls, and only for the levels the user
 * actually has saved.
 */
export async function resolvePlaceSelection(
  provinceId: string | null,
  districtId: string | null,
  communeId: string | null,
): Promise<UserPlaceSelection> {
  const empty: UserPlaceSelection = {
    province: null,
    district: null,
    commune: null,
  };
  if (!provinceId) return empty;

  const provinces = await getProvinces();
  const province = provinces.find((p) => p.id === provinceId) ?? null;
  if (!province) return empty;
  if (!districtId) return { ...empty, province };

  const districts = await getDistricts(province.slug);
  const district = districts.find((d) => d.id === districtId) ?? null;
  if (!district) return { ...empty, province };
  if (!communeId) return { province, district, commune: null };

  const communes = await getCommunes(province.slug, district.slug);
  return {
    province,
    district,
    commune: communes.find((c) => c.id === communeId) ?? null,
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

// `getVehicleTypes()` was removed 2026-09-16. The duplicate `vehicletypes`
// attribute set is retired in favour of `bodytypes`, so there is no second
// "kind of vehicle" list: Vehicles For Rent's Vehicle Type field now reads
// `getBodyTypes()` and therefore follows the admin's Body Type ticks.
