"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  MessagesSquare,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  deleteConversation,
  fetchConversationWith,
  fetchInbox,
  getChatViewer,
} from "@/actions/chat";
import { chatKeys, isUnauthenticated, unwrap } from "@/lib/chat/queries";
import { readListingPreview } from "@/lib/chat/listing-handoff";
import { CHAT_POLL } from "@/hooks/use-chat-polling";
import { useChatRealtimeEvents } from "@/hooks/use-chat-ws";
import { useE2eEngine } from "@/hooks/use-e2e-engine";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageThread } from "@/components/chat/message-thread";
import { E2eBackupPanel } from "@/components/chat/e2e-backup-panel";
import type { InboxItem, ListingContext } from "@/types/chat";

const SIDEBAR_COLLAPSED_KEY = "chat_sidebar_collapsed";

// `localStorage.setItem` never fires a `storage` event in the SAME tab that
// wrote it (only OTHER tabs get notified) — so `setSidebarCollapsed` below
// notifies this tiny listener set itself after every write, which is what
// lets `useSyncExternalStore` re-render this tab immediately on toggle.
const sidebarCollapsedListeners = new Set<() => void>();

function getSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false; // private mode / quota
  }
}

function getSidebarCollapsedServerSnapshot(): boolean {
  return false;
}

function setSidebarCollapsed(next: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    // Private mode / quota — the toggle still works for this render, it
    // just won't survive a reload.
  }
  sidebarCollapsedListeners.forEach((listener) => listener());
}

function subscribeSidebarCollapsed(listener: () => void): () => void {
  sidebarCollapsedListeners.add(listener);
  return () => sidebarCollapsedListeners.delete(listener);
}

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

  // Preview card for `listingFromUrl` before the first message rides it to
  // the server — stashed by ContactSellerButton for this tab (see
  // lib/chat/listing-handoff.ts). Lazy initializer: read once at mount, not
  // in an effect — `listingFromUrl` is a one-shot deep-link param that never
  // changes for the life of this component.
  const [listingPreview] = useState<ListingContext | null>(() => {
    if (initialListing !== undefined) return initialListing ?? null;
    return listingFromUrl ? readListingPreview(listingFromUrl) : null;
  });

  // ── Viewer ────────────────────────────────────────────────────────────────
  const viewer = useQuery({
    queryKey: chatKeys.viewer(),
    queryFn: async () => unwrap(await getChatViewer()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Warm E2E bootstrap as soon as the viewer is known so key registration
  // races ahead of the first send (fail-closed on send if still pending).
  const e2eEngine = useE2eEngine(
    viewer.isSuccess ? (viewer.data?.id ?? null) : null,
  );

  // ── Inbox ─────────────────────────────────────────────────────────────────
  // The nav badge's own socket subscription keeps the shared connection alive
  // sitewide, but this hook still needs its own subscription here: it is what
  // gates the poll below off, and the badge's connection state isn't visible
  // outside its own component.
  const { isConnected: realtimeConnected } = useChatRealtimeEvents({
    enabled: viewer.isSuccess,
    onEvent: (event) => {
      if (event.type === "inbox_update")
        void queryClient.invalidateQueries({ queryKey: chatKeys.inbox() });
    },
  });

  const inbox = useInfiniteQuery({
    queryKey: chatKeys.inbox(),
    enabled: viewer.isSuccess,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      unwrap(await fetchInbox(pageParam ?? undefined)),
    getNextPageParam: (last) => last.meta.nextCursor,
    // Realtime push (see the subscription above) replaces the poll once the
    // socket is up; the interval stays as the fallback while it isn't.
    refetchInterval: realtimeConnected ? false : CHAT_POLL.inboxMs,
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

  // ── Sidebar collapse (desktop only — mobile already toggles list/thread
  // via threadOpen, so there's no room to also collapse there) ──────────────
  // useSyncExternalStore, not useState+effect: reading localStorage during an
  // effect and then calling setState is the classic hydration-mismatch trap
  // (server has no localStorage, so first paint and the post-mount update
  // disagree). useSyncExternalStore's getServerSnapshot is exactly the
  // sanctioned way to read a browser-only store safely — React renders the
  // server snapshot through hydration, then reconciles to the real one.
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsed,
    getSidebarCollapsedServerSnapshot,
  );
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed]);

  // ── Delete conversation (per-participant hide, see DELETE /chats/:id) ─────
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDelete = useCallback(
    async (item: InboxItem) => {
      setDeletingId(item.id);
      const res = await deleteConversation(item.id);
      setDeletingId(null);

      if (!res.ok) {
        toast.error(res.message || t("errors.generic"));
        return;
      }

      toast.success(t("inbox.deleteSuccess"));
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox() });
      // The deleted thread was open — back out to the list rather than
      // leaving a stale/gone conversation on screen.
      if (item.otherUser && selectedPeerId === item.otherUser.id) {
        setSelectedPeerId(null);
      }
    },
    [queryClient, selectedPeerId, t],
  );

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
      {/* Inbox column — full width on mobile until a thread is opened.
          Collapsible to a narrow avatar rail on desktop only (md:). */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-border bg-card md:w-[300px] md:border-r lg:w-[340px]",
          threadOpen && "hidden md:flex",
          sidebarCollapsed && "md:w-16 lg:w-16",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b border-border px-4 py-3",
            sidebarCollapsed ? "md:justify-center md:px-2" : "justify-between",
          )}
        >
          <h1
            className={cn(
              "text-sm font-semibold",
              sidebarCollapsed && "md:hidden",
            )}
          >
            {t("inbox.title")}
          </h1>
          <div className="flex items-center gap-1.5">
            {inbox.isFetching && !inbox.isFetchingNextPage && (
              <Loader2
                className={cn(
                  "size-3.5 animate-spin text-muted-foreground",
                  sidebarCollapsed && "md:hidden",
                )}
              />
            )}
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-label={
                sidebarCollapsed ? t("inbox.expand") : t("inbox.collapse")
              }
              className="hidden shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </button>
          </div>
        </div>
        <ConversationList
          items={items}
          viewerId={viewerId}
          activeId={conversationId}
          onSelect={handleSelect}
          isLoading={inbox.isPending}
          hasMore={inbox.hasNextPage}
          isLoadingMore={inbox.isFetchingNextPage}
          onLoadMore={() => void inbox.fetchNextPage()}
          onDelete={handleDelete}
          deletingId={deletingId}
          collapsed={sidebarCollapsed}
        />
      </aside>

      {/* Thread column */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          threadOpen ? "flex" : "hidden md:flex",
        )}
      >
        <E2eBackupPanel engine={e2eEngine} />
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
                ? listingPreview
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
    <div className="flex h-[calc(100dvh-3.5rem-1rem)] min-h-[480px] overflow-hidden border border-border bg-background ">
      {children}
    </div>
  );
}
