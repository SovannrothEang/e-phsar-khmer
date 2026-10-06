"use server";

import { ApiError, userServerFetch } from "@/lib/api/user-client";
import { getMyReactionPage } from "@/lib/api/reactions";
import type { Post } from "@/lib/posts";

/**
 * Mutations report `{ success, error? }` — the shape the rest of the
 * user-facing actions use. The backend is idempotent both ways, so a
 * double-fire is harmless and the toggle's end state is the whole contract.
 */
export interface ReactionActionResult {
  success: boolean;
  error?: string;
  liked?: boolean;
  saved?: boolean;
  /** The fresh count from the toggle, so the detail control stays in step. */
  likeCount?: number;
}

function toFailure(err: unknown): ReactionActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: "Network error" };
}

export async function likeListing(
  listingId: string,
): Promise<ReactionActionResult> {
  try {
    const { data } = await userServerFetch<{
      liked: boolean;
      likeCount: number;
    }>(`/listings/${listingId}/like`, { method: "POST" });
    return { success: true, liked: data.liked, likeCount: data.likeCount };
  } catch (err) {
    return toFailure(err);
  }
}

export async function unlikeListing(
  listingId: string,
): Promise<ReactionActionResult> {
  try {
    const { data } = await userServerFetch<{
      liked: boolean;
      likeCount: number;
    }>(`/listings/${listingId}/like`, { method: "DELETE" });
    return { success: true, liked: data.liked, likeCount: data.likeCount };
  } catch (err) {
    return toFailure(err);
  }
}

export async function saveListing(
  listingId: string,
): Promise<ReactionActionResult> {
  try {
    const { data } = await userServerFetch<{ saved: boolean }>(
      `/listings/${listingId}/save`,
      { method: "POST" },
    );
    return { success: true, saved: data.saved };
  } catch (err) {
    return toFailure(err);
  }
}

export async function unsaveListing(
  listingId: string,
): Promise<ReactionActionResult> {
  try {
    const { data } = await userServerFetch<{ saved: boolean }>(
      `/listings/${listingId}/save`,
      { method: "DELETE" },
    );
    return { success: true, saved: data.saved };
  } catch (err) {
    return toFailure(err);
  }
}

export interface ReactionPageResult {
  items: Post[];
  hasMore: boolean;
  error?: string;
}

/**
 * One page of a liked/saved list, for the `/me` panels' "Load more".
 *
 * The lists are JWT-scoped, so the browser cannot fetch them itself and this
 * has to run where the session cookies are. An empty list and a failure both
 * come back as `items: []`; only `error` distinguishes them.
 */
export async function loadMyReactionPage(
  side: "likes" | "saves",
  page: number,
): Promise<ReactionPageResult> {
  try {
    const { items, hasMore } = await getMyReactionPage(side, page);
    return { items, hasMore };
  } catch (err) {
    return {
      items: [],
      hasMore: false,
      error: err instanceof ApiError ? err.message : "Network error",
    };
  }
}
