export type SubscriptionCategory = {
  subscriptionCateId: string;
  subscriptioncatename: string;
  subscriptioncateslug: string;
  desc: string;
  subscriptionplans: SubscriptionPlan[];
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriptionPlan = {
  subscriptionPlanId: string;
  subscriptionplanname: string;
  subscriptionplanslug: string;
  subscriptionplandesc: string;
  subscriptionpackage: SubscriptionPackageOption[];
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriptionPackageOption = {
  SubscriptionPackageId: string;
  subscriptionPackagename: string;
  subscriptionPackagephoto: string;
  subscriptionPackageads: string;
  subscriptionPackagerenews: string;
  subscriptionPackageautorenews: string;
  subscriptionPackagevideos: string;
  subscriptionterm: SubscriptionTermOption[];
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionTermDurationUnit = "day" | "month" | "year";

export type SubscriptionTermOption = {
  SubscriptionTermId: string;
  subscriptiontermname: string;
  subscriptiontermdurationvalue: number;
  subscriptiontermdurationunit: SubscriptionTermDurationUnit;
  subscriptiontermprice: number;
  subscriptiontermdiscount: number;
  subscriptiontermdiscounttype: SubscriptionTermDiscountType;
  createdAt: Date;
  updatedAt: Date;
};
export type SubscriptionTermDiscountType = "percent" | "amount";

export type SupersededReason = "upgrade" | "replaced" | "expired" | "revoked";

export type SubscriptionStatus =
  | "active"
  | "expired"
  | "superseded"
  | "revoked";

export type BucketKey =
  | `group:${string}`
  | `sub:${string}`
  | `cat:${string}`
  | "other";

export interface SubscriptionCatalogItem {
  groupId: string;
  groupName: string;
  groupSlug: string;
  groupDescription: string | null;
  planId: string;
  planName: string;
  packageId: string;
  packageName: string;
  termId: string;
  termName: string;
  durationValue: number;
  durationUnit: SubscriptionTermDurationUnit;
  price: string;
  discount: string;
  discountType: SubscriptionTermDiscountType;
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
  /** The group this subscription belongs to. */
  groupId: string | null;
  groupName: string | null;
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
  status: SubscriptionStatus;
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
  /** Registered but missing credentials — show it, don't let it be picked. */
  available: boolean;
}

export interface PlanLimits {
  photos: number;
  ads: number;
  renews: number;
  autoRenews: number;
  videos: number;
}

export interface EntitlementBucket {
  key: BucketKey;
  kind: "group" | "free";
  name: string;
  groupId: string | null;
  limits: PlanLimits;
  used: number;
  expiresAt: string | null;
}

export interface PlanEntitlements {
  plan: "free" | "premium";
  limits: PlanLimits;
  expiresAt: string | null;
  usage: { ads: number };
  bucket: EntitlementBucket | null;
  buckets: EntitlementBucket[];
}

export interface PublicFreePlan {
  photos: number;
  renews: number;
  autoRenews: number;
  videos: number;
  otherAds: number;
  caps: { key: BucketKey; name: string; ads: number }[];
}
