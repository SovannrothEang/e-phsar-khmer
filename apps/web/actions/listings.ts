"use server";

import { ApiError, userServerFetch } from "@/lib/api/client";
import {
  type BackendAttributeRow,
  type BackendBrand,
  type BackendListing,
  type BackendModel,
  getBrandsForSubcategory,
  getBodyTypes,
  getCategoryWithSubcategories,
  getColors,
  getModelsForBrand,
  getYears,
} from "@/lib/api/categories";
import type { BackendUser } from "@/lib/api/adapters";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatPhoneLocal } from "@/lib/phone";

/** Row of `GET /users/me/phones` — only `phone` is read here. */
interface UserPhoneRow {
  phone: string;
}

/**
 * The logged-in user's contact info, prefilled into the form's contact
 * section (name, up to 3 phones in local format, email if the profile has
 * one). Empty when the seller has no profile data.
 */
export interface CarsContactPrefill {
  name: string;
  phones: string[];
  email: string | null;
}

async function getUserContactPrefill(): Promise<CarsContactPrefill> {
  const user = await getCurrentUser();
  if (!user) return { name: "", phones: [], email: null };

  const [phonesRes, meRes] = await Promise.all([
    userServerFetch<UserPhoneRow[]>("/users/me/phones").catch(() => null),
    userServerFetch<BackendUser>("/auth/me").catch(() => null),
  ]);
  const me = meRes?.data;

  const name =
    [me?.firstName, me?.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    "";

  const phones = (phonesRes?.data ?? []).map((p) => p.phone);
  if (phones.length === 0 && user.primaryPhone) phones.push(user.primaryPhone);

  return {
    name,
    phones: [...new Set(phones)].map(formatPhoneLocal).slice(0, 3),
    email: me?.email ?? null,
  };
}

/**
 * Data the cars-for-sale form needs to render its selects — category and
 * subcategory UUIDs (the create DTO takes IDs, not slugs) plus the option
 * lists. All of it is public backend data and lives here (not in the client)
 * because `API_URL` is only reachable from server context.
 */
export interface CarsForSaleConfig {
  categoryId: string;
  subcategoryId: string;
  brands: BackendBrand[];
  bodyTypes: BackendAttributeRow[];
  colors: BackendAttributeRow[];
  years: string[];
  contact: CarsContactPrefill;
}

export async function getCarsForSaleConfig(
  locale: string,
): Promise<CarsForSaleConfig | null> {
  const category = await getCategoryWithSubcategories(
    "cars-and-vehicles",
    locale,
  );
  const sub = category?.subcategories.find((s) => s.slug === "cars-for-sale");
  if (!category || !sub) return null;

  const [brands, bodyTypes, years, colors, contact] = await Promise.all([
    getBrandsForSubcategory("cars-for-sale"),
    getBodyTypes(),
    getYears(),
    getColors(),
    getUserContactPrefill(),
  ]);

  const forSub = (rows: BackendAttributeRow[]) => {
    const filtered = rows.filter((r) => r.subcategoryIds.includes(sub.id));
    return filtered.length > 0 ? filtered : rows; // seed gap fallback
  };

  return {
    categoryId: category.id,
    subcategoryId: sub.id,
    brands,
    bodyTypes: forSub(bodyTypes),
    colors: forSub(colors),
    years: years.map((y) => y.name),
    contact,
  };
}

/** Models for the chosen brand — passthrough for `getModelsForBrand`. */
export async function getCarModels(brandId: string): Promise<BackendModel[]> {
  return getModelsForBrand(brandId);
}

/**
 * Mirrors the backend `CreateListingDto` exactly — the web app is standalone,
 * so no backend DTO import; the validation pipe whitelists + forbids stray
 * keys, so the client must never send anything beyond these fields.
 */
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
  deliveryFree?: boolean;
  contactName?: string;
  contactPhones?: string[];
  contactEmail?: string;
}

export type CreateListingResult =
  | { success: true; listingId: string; warning?: string }
  | { success: false; error: string };

/**
 * Creates the listing (backend stores it as a draft) then immediately
 * publishes it — the feed only shows `active`. A publish failure still counts
 * as success so the seller can view/retry their draft; a create failure is a
 * hard error.
 */
export async function createListing(
  payload: CreateListingPayload,
): Promise<CreateListingResult> {
  try {
    const { data } = await userServerFetch<BackendListing>("/listings", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    try {
      await userServerFetch(`/listings/${data.id}/publish`, {
        method: "POST",
      });
    } catch {
      return {
        success: true,
        listingId: data.id,
        warning: "Your ad was saved as a draft but could not be published yet.",
      };
    }
    return { success: true, listingId: data.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Failed to create listing",
    };
  }
}
