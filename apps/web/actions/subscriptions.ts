"use server";

import { ApiError, userServerFetch } from "@/lib/api/client";

export interface SubscriptionCatalogItem {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryDescription: string | null;
  planId: string;
  planName: string;
  packageId: string;
  packageName: string;
  termId: string;
  termName: string;
  durationValue: number;
  durationUnit: "day" | "month" | "year";
  price: string;
  discount: string;
  discountType: "percent" | "amount";
  photos: number;
  ads: number;
  renews: number;
  autoRenews: number;
  videos: number;
}

export interface UserSubscription {
  id: string;
  purchaseId: string | null;
  termId: string | null;
  termName: string | null;
  /** The group (subscription category) this subscription belongs to. */
  categoryId: string | null;
  categoryName: string | null;
  planName: string | null;
  packageName: string | null;
  photos: number;
  ads: number;
  renews: number;
  autoRenews: number;
  videos: number;
  priceUsd: string;
  subscribedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "superseded" | "revoked";
}

export interface PaymentTransactionStatus {
  id: string;
  status:
    | "pending"
    | "processing"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "expired"
    | "refund_pending"
    | "refunded";
  amount: string;
  currency: string;
  checkout: {
    redirectUrl: string | null;
    rawResponse: unknown;
  } | null;
}

export interface PaymentProvider {
  name: string;
  displayName: string;
  /** Registered but missing credentials � show it, don't let it be picked. */
  available: boolean;
}

export async function getPaymentProviders(): Promise<PaymentProvider[]> {
  const { data } = await userServerFetch<PaymentProvider[]>(
    "/payments/providers",
  );
  return data;
}

export interface PlanLimits {
  photos: number;
  ads: number;
  renews: number;
  autoRenews: number;
  videos: number;
}

/**
 * One allowance: a group the user holds (its package limits, shared by all
 * the group's subcategories) or a free-plan cap ("Cars for sale", "Other ads").
 */
export interface EntitlementBucket {
  key: string;
  kind: "group" | "free";
  name: string;
  groupId: string | null;
  limits: PlanLimits;
  used: number;
  expiresAt: string | null;
}

export interface PlanEntitlements {
  /** "premium" when the user holds a live subscription in any group. */
  plan: "free" | "premium";
  /**
   * With a subcategory: that subcategory's bucket. Without: the free plan's
   * account-wide numbers (ads = the shared "other ads" cap).
   */
  limits: PlanLimits;
  expiresAt: string | null;
  /** With a subcategory: ads in its bucket. Without: every live ad. */
  usage: { ads: number };
  bucket: EntitlementBucket | null;
  buckets: EntitlementBucket[];
}

/** Pass the subcategory being posted to for the limits that apply there. */
export async function getMyEntitlements(
  subcategoryId?: string,
): Promise<PlanEntitlements> {
  const query = subcategoryId
    ? `?subcategoryId=${encodeURIComponent(subcategoryId)}`
    : "";
  const { data } = await userServerFetch<PlanEntitlements>(
    `/subscriptions/entitlements${query}`,
  );
  return data;
}

export async function getSubscriptionCatalog(): Promise<
  SubscriptionCatalogItem[]
> {
  const { data } = await userServerFetch<SubscriptionCatalogItem[]>(
    "/subscriptions/catalog",
  );
  return data;
}

export async function getMySubscriptions(): Promise<UserSubscription[]> {
  const { data } =
    await userServerFetch<UserSubscription[]>("/subscriptions/me");
  return data;
}

export async function createSubscriptionCheckout(input: {
  termId: string;
  idempotencyKey: string;
  provider: string;
}) {
  try {
    const { data } = await userServerFetch<{
      purchaseId: string;
      paymentTransactionId: string;
      amount: string;
      currency: string;
    }>("/subscriptions/checkout", {
      method: "POST",
      body: JSON.stringify({ ...input, method: "bank" }),
    });
    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof ApiError ? error.message : "Checkout failed",
    };
  }
}

export async function getPaymentTransactionStatus(id: string) {
  try {
    const { data } = await userServerFetch<PaymentTransactionStatus>(
      `/payments/${id}`,
    );
    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof ApiError ? error.message : "Could not check payment",
    };
  }
}
