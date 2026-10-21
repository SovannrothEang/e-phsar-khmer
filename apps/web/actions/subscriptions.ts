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

export interface PlanEntitlements {
  plan: "free" | "premium";
  limits: {
    photos: number;
    ads: number;
    renews: number;
    autoRenews: number;
    videos: number;
  };
  expiresAt: string | null;
  usage: { ads: number };
}

export async function getMyEntitlements(): Promise<PlanEntitlements> {
  const { data } = await userServerFetch<PlanEntitlements>(
    "/subscriptions/entitlements",
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
