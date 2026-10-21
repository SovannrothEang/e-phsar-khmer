"use server";

import { serverFetch, ApiError } from "@/lib/api/client";

export interface UserSubscriptionRow {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: string | null;
  totalAds: number;
  totalRenew: number;
  autoRenew: number;
  plan: string | null;
  price: string;
  paymentMethod: string | null;
  subscribedAt: string;
  expiresAt: string;
  supersededAt: string | null;
  supersededReason: string | null;
  status: "active" | "expired" | "superseded" | "revoked";
}

/** Current subscriptions (one per user); `history` adds superseded rows. */
export async function getUserSubscriptions(
  history = false,
): Promise<UserSubscriptionRow[]> {
  const { data } = await serverFetch<UserSubscriptionRow[]>(
    `/admin/user-subscriptions${history ? "?history=true" : ""}`,
  );
  return data;
}

export async function grantSubscription(input: {
  userId: string;
  termId: string;
  paymentMethod?: string;
}) {
  try {
    await serverFetch("/admin/user-subscriptions", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Failed to grant",
    };
  }
}

/** Ends a current subscription; the row is kept as history, never deleted. */
export async function revokeUserSubscription(id: string) {
  try {
    await serverFetch(`/admin/user-subscriptions/${id}/revoke`, {
      method: "POST",
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Failed to revoke",
    };
  }
}
