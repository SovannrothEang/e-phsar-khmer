"use server";

import { serverFetch, ApiError } from "@/lib/api/client";

export type AdminListingStatus =
  | "draft"
  | "active"
  | "expired"
  | "deleted"
  | "restricted"
  | "inactive";

export interface AdminListingRow {
  id: string;
  title: string;
  status: AdminListingStatus;
  price: string | null;
  currency: string;
  userId: string;
  sellerUsername: string | null;
  categorySlug: string | null;
  subcategorySlug: string | null;
  coverPhotoUrl: string | null;
  pendingReports: number;
  createdAt: string;
  publishedAt: string | null;
  expiresAt: string | null;
  moderatedAt: string | null;
  moderationReason: string | null;
  inactiveAt: string | null;
  inactiveReason: string | null;
  /** Set on a permanent delete; the dashboard must not offer Restore. */
  deletedAt: string | null;
}

export interface AdminListingsQuery {
  q?: string;
  status?: AdminListingStatus;
  moderated?: boolean;
  categorySlug?: string;
  subcategorySlug?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminListingsPage {
  rows: AdminListingRow[];
  total: number;
}

export async function getAdminListings(
  query: AdminListingsQuery,
): Promise<AdminListingsPage> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.moderated !== undefined)
    params.set("moderated", String(query.moderated));
  if (query.categorySlug) params.set("categorySlug", query.categorySlug);
  if (query.subcategorySlug)
    params.set("subcategorySlug", query.subcategorySlug);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));

  const { data, meta } = await serverFetch<AdminListingRow[]>(
    `/admin/listings?${params.toString()}`,
  );
  return { rows: data, total: meta?.total ?? data.length };
}

export async function removeListing(id: string, reason: string) {
  try {
    await serverFetch(`/admin/listings/${id}/remove`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() }),
    });
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof ApiError ? err.message : "Failed to remove listing",
      code: err instanceof ApiError ? err.code : undefined,
    };
  }
}

/**
 * Hides a listing until its owner fixes and republishes it. Unlike
 * `removeListing`, the seller keeps control and gets a notification with the
 * reason. The backend requires the reason (it is shown to the seller).
 */
export async function inactivateListing(id: string, reason: string) {
  try {
    await serverFetch(`/admin/listings/${id}/inactivate`, {
      method: "POST",
      body: JSON.stringify({ reason: reason.trim() }),
    });
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof ApiError
          ? err.message
          : "Failed to set listing inactive",
      code: err instanceof ApiError ? err.code : undefined,
    };
  }
}

export async function restoreListing(id: string) {
  try {
    await serverFetch(`/admin/listings/${id}/restore`, { method: "POST" });
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof ApiError ? err.message : "Failed to restore listing",
    };
  }
}
