import "server-only";
import { userServerFetch } from "@/lib/api/user-client";
import { toCardPost } from "@/lib/api/categories";
import type { BackendListing } from "@/lib/api/categories";
import type { FeedQuery } from "@/lib/search-params";
import type { Post } from "@/lib/posts";

/**
 * `hidden` is the backend's stored `restricted` status. Staff-inactive ads are
 * not a tab: they stay in `active` and are flagged on the row.
 */
export type MyAdsTab = "active" | "expired" | "hidden";

const TABS: MyAdsTab[] = ["active", "expired", "hidden"];
const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `hidden` is the backend's stored `restricted` status. */
const STATUS_PARAM: Record<MyAdsTab, string> = {
  active: "active",
  expired: "expired",
  hidden: "restricted",
};

/**
 * The owner feed's filters as a query string — the same vocabulary (and the
 * same serialisation) the public feed uses, so the Manage Ads bar writes URLs
 * that mean what they mean everywhere else.
 */
function filterQuery(filters: FeedQuery): string {
  const qs = new URLSearchParams();
  const { attrs, ...rest } = filters;
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === "" || value === false) continue;
    qs.set(key, String(value));
  }
  if (attrs && Object.keys(attrs).length > 0) {
    qs.set("attrs", JSON.stringify(attrs));
  }
  return qs.toString();
}

async function fetchStatus(
  tab: MyAdsTab,
  page: number,
  size: number,
  filterQs: string,
) {
  const { data, meta } = await userServerFetch<BackendListing[]>(
    `/listings/me/all?status=${STATUS_PARAM[tab]}&limit=${size}&page=${page}&pageSize=${size}${filterQs ? `&${filterQs}` : ""}`,
  );
  return {
    rows: data,
    total: meta?.total ?? data.length,
    hasMore: !!meta?.hasMore,
  };
}

/**
 * One page of the signed-in user's own ads for a Manage Ads tab, plus every
 * tab's total (the others are `limit=1` count probes, only on page 1).
 * Authenticated — throws `ApiError` (401) without a session.
 */
export async function getMyAdsPage(
  tab: MyAdsTab,
  page: number,
  filters: FeedQuery = {},
): Promise<{
  items: Post[];
  hasMore: boolean;
  counts: Partial<Record<MyAdsTab, number>>;
}> {
  const others = TABS.filter((other) => other !== tab);
  const probeTabs = page === 1 ? others : [];
  // The probes carry the same filters as the list, so a tab's count is the
  // count *under the current filter* rather than a number the list can never
  // match.
  const filterQs = filterQuery(filters);
  const [current, ...probes] = await Promise.all([
    fetchStatus(tab, page, PAGE_SIZE, filterQs),
    ...probeTabs.map((other) => fetchStatus(other, 1, 1, filterQs)),
  ]);
  const counts: Partial<Record<MyAdsTab, number>> = { [tab]: current.total };
  probeTabs.forEach((other, index) => {
    counts[other] = probes[index].total;
  });
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
        // Staff-inactive ads live in the Active tab; the row flag marks them
        // and hides the actions the owner no longer has (republish).
        inactive: row.status === "inactive",
        expiresInDays: left === null ? undefined : Math.ceil(left / DAY_MS),
      };
    }),
    hasMore: current.hasMore,
    counts,
  };
}

/**
 * The owner's full row for the edit page — every column the create form can
 * write, plus the category slugs and the derived status. The public detail
 * 404s drafts/restricted/moderated ads, so it cannot prefill them; this
 * authenticated read is the one source for the edit screen.
 */
export interface OwnedListing extends BackendListing {
  categorySlug: string | null;
  subcategorySlug: string | null;
  effectiveStatus: BackendListing["status"];
  /** Set when staff took the ad down; the edit page must not offer the form. */
  moderatedAt: string | null;
}

export async function getMyListingById(id: string): Promise<OwnedListing> {
  const { data } = await userServerFetch<OwnedListing>(`/listings/me/${id}`);
  return data;
}
