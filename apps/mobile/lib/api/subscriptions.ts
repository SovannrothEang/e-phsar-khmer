import { apiFetch } from "@/lib/api/client";

export type SubscriptionDurationUnit = "day" | "month" | "year";
export type SubscriptionDiscountType = "percent" | "amount";

export interface SubscriptionCatalogItem {
  groupId: string;
  groupName: string;
  groupSlug: string;
  groupDescription: string | null;
  packageId: string;
  packageName: string;
  termId: string;
  termName: string;
  durationValue: number;
  durationUnit: SubscriptionDurationUnit;
  price: string;
  discount: string;
  discountType: SubscriptionDiscountType;
  photos: number;
  ads: number;
  renews: number;
  autoRenews: number;
  videos: number;
}

/** The public free-plan sheet: limits plus every per-category ad cap. */
export interface PublicFreePlan {
  photos: number;
  renews: number;
  autoRenews: number;
  videos: number;
  otherAds: number;
  caps: { key: string; name: string; ads: number }[];
}

export interface PaymentProvider {
  name: string;
  displayName: string;
  /** Registered but missing credentials — show it, but don't let it be picked. */
  available: boolean;
}

export interface SubscriptionCheckout {
  purchaseId: string;
  paymentTransactionId: string;
  amount: string;
  currency: string;
}

export type PaymentStatusValue =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "refund_pending"
  | "refunded";

export interface PaymentStatus {
  id: string;
  status: PaymentStatusValue;
  amount: string;
  currency: string;
  checkout: {
    redirectUrl: string | null;
    rawResponse: unknown;
  } | null;
}

export interface BillingAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

export type SubscriptionStatus =
  | "active"
  | "expired"
  | "superseded"
  | "revoked";

/** One row of `GET /subscriptions/me`. */
export interface MySubscription {
  id: string;
  purchaseId: string | null;
  termId: string | null;
  termName: string | null;
  groupId: string | null;
  groupName: string | null;
  packageName: string | null;
  photos: number;
  ads: number;
  renews: number;
  autoRenews: number;
  videos: number;
  priceUsd: string;
  subscribedAt: string;
  expiresAt: string;
  status: SubscriptionStatus;
}

export async function fetchMySubscriptions(): Promise<MySubscription[]> {
  const { data } = await apiFetch<MySubscription[]>("/subscriptions/me");
  return data ?? [];
}

export async function fetchSubscriptionCatalog(): Promise<
  SubscriptionCatalogItem[]
> {
  const { data } = await apiFetch<SubscriptionCatalogItem[]>(
    "/subscriptions/catalog",
  );
  return data ?? [];
}

export async function fetchFreePlan(): Promise<PublicFreePlan | null> {
  const { data } = await apiFetch<PublicFreePlan>("/subscriptions/free-plan");
  return data ?? null;
}

export async function fetchPaymentProviders(): Promise<PaymentProvider[]> {
  const { data } = await apiFetch<PaymentProvider[]>("/payments/providers");
  return data ?? [];
}

export async function createSubscriptionCheckout(input: {
  termId: string;
  idempotencyKey: string;
  provider: string;
}): Promise<SubscriptionCheckout> {
  const { data } = await apiFetch<SubscriptionCheckout>(
    "/subscriptions/checkout",
    {
      method: "POST",
      body: { ...input, method: "bank" },
    },
  );
  return data;
}

export async function fetchPaymentStatus(id: string): Promise<PaymentStatus> {
  const { data } = await apiFetch<PaymentStatus>(
    `/payments/${encodeURIComponent(id)}`,
  );
  return data;
}

/** Fail-soft: the review screen renders its empty state instead of failing. */
export async function fetchBillingAddresses(): Promise<BillingAddress[]> {
  try {
    const { data } = await apiFetch<BillingAddress[]>(
      "/users/me/billing-addresses",
    );
    return data ?? [];
  } catch {
    return [];
  }
}
