"use server";

import { ApiError, userServerFetch } from "@/lib/api/user-client";
import { getFollowList, getFollowStatus, toFollowRow } from "@/lib/api/users";
import type { FollowRowUser, FollowSide } from "@/lib/api/users";

/**
 * Mutations report `{ success, error? }` — the shape the rest of the
 * user-facing actions use.
 */
export interface FollowActionResult {
  success: boolean;
  error?: string;
  /** The state after the call — what the toggle should now show. */
  following?: boolean;
}

function toFailure(err: unknown): FollowActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: "Network error" };
}

/**
 * Follow a user. Idempotent on the backend, so a double-fire is harmless.
 * No `revalidatePath` here — the caller owns the refresh (`router.refresh()`
 * after a successful toggle), the same way `uploadUserPhoto` works.
 */
export async function followUser(userId: string): Promise<FollowActionResult> {
  try {
    const { data } = await userServerFetch<{ following: boolean }>(
      `/users/${userId}/follow`,
      { method: "POST" },
    );
    return { success: true, following: data.following };
  } catch (err) {
    return toFailure(err);
  }
}

/**
 * The viewer's follow state for one seller, exposed as an action so the
 * listing detail page can resolve it in the browser after mount instead of
 * putting a per-viewer answer into the server HTML. Fail-soft: a request that
 * does not succeed reads as "not following", which is the honest answer for an
 * anonymous visitor and leaves the toggle working.
 */
export async function loadFollowStatus(userId: string): Promise<boolean> {
  return getFollowStatus(userId);
}

/** Unfollow a user. Also idempotent — unfollowing twice is not an error. */
export async function unfollowUser(
  userId: string,
): Promise<FollowActionResult> {
  try {
    const { data } = await userServerFetch<{ following: boolean }>(
      `/users/${userId}/follow`,
      { method: "DELETE" },
    );
    return { success: true, following: data.following };
  } catch (err) {
    return toFailure(err);
  }
}

export interface FollowListResult {
  items: FollowRowUser[];
  hasMore: boolean;
  error?: string;
}

/**
 * One page of a follower/following list, for the profile's `?tab=` panel.
 *
 * The lists are **JWT-scoped by design** — that is what lets every row carry
 * its viewer-relative `isFollowing` without an N+1 — so the browser cannot
 * fetch them itself and this has to run on the server, where the cookies are.
 *
 * An empty list and a failure both come back as `items: []`; only `error`
 * distinguishes them, so the panel never renders "no followers" for a request
 * that did not succeed.
 */
export async function loadFollowList(
  userId: string,
  side: FollowSide,
): Promise<FollowListResult> {
  try {
    const { data, hasMore } = await getFollowList(userId, side);
    // The raw rows are the backend's shape; the card renders the UI one.
    return { items: data.map(toFollowRow), hasMore };
  } catch (err) {
    return {
      items: [],
      hasMore: false,
      error: err instanceof ApiError ? err.message : "Network error",
    };
  }
}
