"use client";

import * as React from "react";
import { Bookmark, Heart } from "lucide-react";
import { GridCardPost } from "@/components/ads/GridCardPost";
import { loadMyReactionPage } from "@/actions/reactions";
import { useReactions } from "@/components/reactions/reactions-provider";
import type { Post } from "@/lib/posts";

/**
 * A liked/saved list for the `/me` pages, fetched in the browser through a
 * server action — those lists are JWT-scoped, so the call has to go out with
 * the session cookies, which only the server has.
 *
 * An empty list and a failed one must not look the same: the error is
 * surfaced rather than rendered as the "no results" design. The empty branch
 * is the design these pages shipped with; only the list branch is new.
 */
const COPY = {
  likes: {
    title: "Liked",
    Icon: Heart,
    body: "Oops! Looks like you haven't liked any posts yet.",
  },
  saves: {
    title: "Saved",
    Icon: Bookmark,
    body: "Oops! Looks like you haven't saved any posts yet.",
  },
} as const;

export default function ReactionAdsPanel({
  side,
}: {
  side: "likes" | "saves";
}) {
  const { title, Icon, body } = COPY[side];
  const { isToggledOff } = useReactions();
  const [items, setItems] = React.useState<Post[] | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await loadMyReactionPage(side, 1);
      if (cancelled) return;
      setItems(result.items);
      setHasMore(result.hasMore);
      setError(result.error ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [side]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);

    void (async () => {
      const next = page + 1;
      const result = await loadMyReactionPage(side, next);
      setLoadingMore(false);

      if (result.error) {
        setError(result.error);
        return;
      }
      setItems((current) => {
        // A listing liked/saved between two pages can shift the boundary —
        // drop anything already on screen rather than draw it twice.
        const seen = new Set((current ?? []).map((p) => p.postId));
        return [
          ...(current ?? []),
          ...result.items.filter((p) => !seen.has(p.postId)),
        ];
      });
      setPage(next);
      setHasMore(result.hasMore);
    })();
  };

  // A row toggled off in this session drops out live (the fetched page was
  // read before that click). The test is the toggle, not membership: the
  // provider's seed sets fail soft to empty, and filtering by membership
  // would blank the whole list whenever that seed fetch failed.
  const kind = side === "likes" ? "like" : "save";
  const visible = (items ?? []).filter(
    (post) => !isToggledOff(kind, String(post.postId)),
  );

  const messageCard = (message: React.ReactNode) => (
    <main className="max-w-2xl mx-auto mt-3">
      <div className="bg-card rounded-xs shadow-sm min-h-[500px] flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );

  return (
    <div className="min-w-full bg-muted pb-50 pt-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-medium text-foreground mb-4">{title}</h1>
        {error ? (
          messageCard(error)
        ) : items === null ? (
          messageCard("Loading…")
        ) : visible.length === 0 ? (
          <main className="max-w-2xl mx-auto mt-3">
            <div className="bg-card rounded-xs shadow-sm  min-h-[500px] flex flex-col items-center justify-center p-6">
              <div className="w-32 h-32 bg-muted rounded-full flex items-center justify-center mb-10 mt-4">
                <Icon className="w-16 h-16 text-gray-500" strokeWidth={2.5} />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-medium text-foreground mb-2">
                  No Result!
                </h2>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </div>
          </main>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-3">
              {visible.map((post) => (
                <GridCardPost key={post.postId} post={post} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-sm border bg-card px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60 cursor-pointer"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
