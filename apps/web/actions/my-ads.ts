"use server";

import { ApiError } from "@/lib/api/user-client";
import { getMyAdsPage } from "@/lib/api/my-ads";
import type { MyAdsTab } from "@/lib/api/my-ads";
import { getMyEntitlements } from "@/actions/subscriptions";
import type { PlanEntitlements } from "@/types/subscription";
import type { Post } from "@/lib/posts";

export interface MyAdsPageResult {
  items: Post[];
  hasMore: boolean;
  counts: Partial<Record<MyAdsTab, number>>;
  /** Plan limits + live usage; null when unavailable (fail-soft). */
  plan?: PlanEntitlements | null;
  error?: string;
}

/**
 * One page of the viewer's own ads for `/me` → Manage Ads. The list is
 * JWT-scoped, so it has to be read where the session cookies are. An empty
 * list and a failure both come back as `items: []`; only `error` tells them
 * apart, so the UI never paints a failed load as "No Result!".
 */
export async function loadMyAds(
  tab: MyAdsTab,
  page: number,
): Promise<MyAdsPageResult> {
  try {
    const [result, plan] = await Promise.all([
      getMyAdsPage(tab, page),
      page === 1 ? getMyEntitlements().catch(() => null) : undefined,
    ]);
    return { ...result, plan };
  } catch (err) {
    return {
      items: [],
      hasMore: false,
      counts: {},
      error: err instanceof ApiError ? err.message : "Network error",
    };
  }
}
