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
  status: "active" | "expired" | "superseded";
}

export async function getUserSubscriptions(): Promise<UserSubscriptionRow[]> {
  const { data } = await serverFetch<UserSubscriptionRow[]>(
    "/admin/user-subscriptions",
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

export async function deleteUserSubscription(id: string) {
  try {
    await serverFetch(`/admin/user-subscriptions/${id}`, { method: "DELETE" });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Failed to delete",
    };
  }
}
