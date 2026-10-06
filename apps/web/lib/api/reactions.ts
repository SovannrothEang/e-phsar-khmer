import "server-only";
import { userServerFetch } from "@/lib/api/user-client";
import { toCardPost } from "@/lib/api/categories";
import type { BackendListing } from "@/lib/api/categories";
import type { Post } from "@/lib/posts";

/**
 * The signed-in viewer's liked and saved listing ids, in one call — the seed
 * for the client reactions provider, so every card on the page starts with a
 * truthful state instead of an N+1.
 *
 * Fail-soft to empty: for an anonymous visitor that is also the honest answer,
 * and a signed-in one simply starts with all hearts unlit rather than losing
 * the page (the same posture `getFollowStatus` takes).
 */
export async function getMyReactionIds(): Promise<{
  liked: string[];
  saved: string[];
}> {
  try {
    const { data } = await userServerFetch<{
      liked: string[];
      saved: string[];
    }>("/users/me/reactions");
    return { liked: data.liked ?? [], saved: data.saved ?? [] };
  } catch {
    return { liked: [], saved: [] };
  }
}

/**
 * One page of a liked/saved list, adapted into the card `Post` shape the
 * listing grids already render. Authenticated — callers must have checked the
 * session first; this throws `ApiError` (401) otherwise.
 */
export async function getMyReactionPage(
  side: "likes" | "saves",
  page = 1,
  pageSize = 20,
): Promise<{ items: Post[]; total: number; hasMore: boolean }> {
  const { data, meta } = await userServerFetch<BackendListing[]>(
    `/users/me/${side}?page=${page}&pageSize=${pageSize}`,
  );
  return {
    items: data.map(toCardPost),
    total: meta?.total ?? data.length,
    hasMore: meta?.hasMore ?? false,
  };
}
