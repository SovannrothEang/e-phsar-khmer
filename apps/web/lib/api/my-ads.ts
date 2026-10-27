import "server-only";
import { userServerFetch } from "@/lib/api/user-client";
import { toCardPost } from "@/lib/api/categories";
import type { BackendListing } from "@/lib/api/categories";
import type { Post } from "@/lib/posts";

export type MyAdsTab = "active" | "expired";

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchStatus(status: MyAdsTab, page: number, size: number) {
  const { data, meta } = await userServerFetch<BackendListing[]>(
    `/listings/me/all?status=${status}&limit=${size}&page=${page}&pageSize=${size}`,
  );
  return {
    rows: data,
    total: meta?.total ?? data.length,
    hasMore: !!meta?.hasMore,
  };
}

/**
 * One page of the signed-in user's own ads for a Manage Ads tab, plus both
 * tabs' totals (the other tab's is a `limit=1` count probe, only on page 1).
 * Authenticated — throws `ApiError` (401) without a session.
 */
export async function getMyAdsPage(
  tab: MyAdsTab,
  page: number,
): Promise<{
  items: Post[];
  hasMore: boolean;
  counts: Partial<Record<MyAdsTab, number>>;
}> {
  const other: MyAdsTab = tab === "active" ? "expired" : "active";
  const [current, probe] = await Promise.all([
    fetchStatus(tab, page, PAGE_SIZE),
    page === 1 ? fetchStatus(other, 1, 1) : Promise.resolve(null),
  ]);
  const counts: Partial<Record<MyAdsTab, number>> = { [tab]: current.total };
  if (probe) counts[other] = probe.total;
  return {
    items: current.rows.map((row) => {
      // Derived here, not in the client: a React render must not read the
      // clock, and this is where the row was fetched anyway.
      const base = toCardPost(row);
      const left = row.expiresAt
        ? new Date(row.expiresAt).getTime() - Date.now()
        : null;
      return {
        ...base,
        expiresInDays: left === null ? undefined : Math.ceil(left / DAY_MS),
      };
    }),
    hasMore: current.hasMore,
    counts,
  };
}
