"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, LogIn, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchConversationWith,
  fetchInbox,
  getChatViewer,
} from "@/actions/chat";
import { chatKeys, isUnauthenticated, unwrap } from "@/lib/chat/queries";
import { CHAT_POLL } from "@/hooks/use-chat-polling";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageThread } from "@/components/chat/message-thread";
import type { InboxItem, ListingContext } from "@/types/chat";

export interface ChatWorkspaceProps {
  /** Deep-link: open (or start) the thread with this user. */
  initialPeerId?: string;
  /** Deep-link: attach this listing to the first message sent. */
  initialListingId?: string;
  /** Optional preview card for `initialListingId` before the first send. */
  initialListing?: ListingContext | null;
}

/**
 * The customer ↔ seller chat surface: inbox on the left, thread on the right.
 * On small screens the two become a single pane — the list until a thread is
 * picked, the thread (with a back arrow) after — because this market is
 * phone-first.
 */
export function ChatWorkspace({
  initialPeerId,
  initialListingId,
  initialListing,
}: ChatWorkspaceProps) {
  const t = useTranslations("Chat");
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const peerFromUrl = initialPeerId ?? searchParams.get("to") ?? null;
  const listingFromUrl =
    initialListingId ?? searchParams.get("listing") ?? null;

  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(
    peerFromUrl,
  );

  // ── Viewer ────────────────────────────────────────────────────────────────
  const viewer = useQuery({
    queryKey: chatKeys.viewer(),
    queryFn: async () => unwrap(await getChatViewer()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // ── Inbox ─────────────────────────────────────────────────────────────────
  const inbox = useInfiniteQuery({
    queryKey: chatKeys.inbox(),
    enabled: viewer.isSuccess,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(await fetchInbox(pageParam ?? undefined)),
    getNextPageParam: (last) => last.meta.nextCursor,
    refetchInterval: CHAT_POLL.inboxMs,
    refetchIntervalInBackground: false,
  });

  const items: InboxItem[] = useMemo(
    () => (inbox.data?.pages ?? []).flatMap((p) => p.items),
    [inbox.data],
  );

  // ── Selected thread context (peer, block state, conversation id) ──────────
  // `GET /chats/with/:userId` is the only source of block state, and it never
  // creates a conversation — so it is safe to call on every thread open.
  const withPeer = useQuery({
    queryKey: chatKeys.with(selectedPeerId ?? "none"),
    enabled: viewer.isSuccess && selectedPeerId !== null,
    queryFn: async () =>
      unwrap(await fetchConversationWith(selectedPeerId as string)),
    staleTime: 30 * 1000,
  });

  const handleSelect = useCallback((item: InboxItem) => {
    if (!item.otherUser) return;
    setSelectedPeerId(item.otherUser.id);
  }, []);

  const handleBack = useCallback(() => setSelectedPeerId(null), []);

  const handleConversationCreated = useCallback(() => {
    // The thread now exists — refresh the inbox and re-resolve `with` so the
    // conversation id lands in cache.
    void queryClient.invalidateQueries({ queryKey: chatKeys.inbox() });
    if (selectedPeerId) {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.with(selectedPeerId),
      });
    }
  }, [queryClient, selectedPeerId]);

  // Keep the URL shareable without a navigation round trip.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedPeerId) url.searchParams.set("to", selectedPeerId);
    else url.searchParams.delete("to");
    window.history.replaceState(null, "", url.toString());
  }, [selectedPeerId]);

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (viewer.isError && isUnauthenticated(viewer.error)) {
    return (
      <Panel>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <LogIn className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t("auth.requiredTitle")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {t("auth.requiredDescription")}
          </p>
          <Button asChild size="sm">
            <Link href="/login">{t("auth.signIn")}</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  if (viewer.isError) {
    return (
      <Panel>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-20 text-center">
          <p className="text-sm font-medium">{t("errors.loadFailedTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {t("errors.loadFailed")}
          </p>
        </div>
      </Panel>
    );
  }

  const viewerId = viewer.data?.id ?? null;
  const threadOpen = selectedPeerId !== null;
  const peer = withPeer.data?.otherUser ?? null;
  const conversationId = withPeer.data?.conversation?.id ?? null;

  return (
    <Panel>
      {/* Inbox column — full width on mobile until a thread is opened */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-border bg-card md:w-[300px] md:border-r lg:w-[340px]",
          threadOpen && "hidden md:flex",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h1 className="text-sm font-semibold">{t("inbox.title")}</h1>
          {inbox.isFetching && !inbox.isFetchingNextPage && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <ConversationList
          items={items}
          activeId={conversationId}
          onSelect={handleSelect}
          isLoading={inbox.isPending}
          hasMore={inbox.hasNextPage}
          isLoadingMore={inbox.isFetchingNextPage}
          onLoadMore={() => void inbox.fetchNextPage()}
        />
      </aside>

      {/* Thread column */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          threadOpen ? "flex" : "hidden md:flex",
        )}
      >
        {!threadOpen && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <MessagesSquare className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("thread.selectPrompt")}
            </p>
          </div>
        )}

        {threadOpen && withPeer.isPending && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {threadOpen && withPeer.isError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium">{t("thread.notFoundTitle")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {t("thread.notFoundDescription")}
            </p>
            <Button variant="outline" size="sm" onClick={handleBack}>
              {t("thread.back")}
            </Button>
          </div>
        )}

        {threadOpen && peer && viewerId && (
          <MessageThread
            // Remount on thread switch: watermark, delta store and optimistic
            // echoes are all per-conversation and must not leak across.
            key={`${peer.id}:${conversationId ?? "new"}`}
            conversationId={conversationId}
            peer={peer}
            viewerId={viewerId}
            canMessage={withPeer.data?.canMessage ?? false}
            blockedByMe={withPeer.data?.blockedByMe ?? false}
            listingId={
              peer.id === peerFromUrl && listingFromUrl
                ? listingFromUrl
                : undefined
            }
            listing={
              peer.id === peerFromUrl && listingFromUrl
                ? (initialListing ?? null)
                : undefined
            }
            onBack={handleBack}
            onConversationCreated={handleConversationCreated}
          />
        )}
      </section>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden border border-border bg-background md:rounded-lg">
      {children}
    </div>
  );
}
