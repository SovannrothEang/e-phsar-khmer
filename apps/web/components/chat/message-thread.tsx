"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Download,
  Loader2,
  MessageSquareOff,
  ShieldAlert,
  X,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { dayKey } from "@/lib/chat/format";
import { saveFromUrl } from "@/lib/chat/save-file";
import { chatKeys, isNotFound } from "@/lib/chat/queries";
import { useChatThread } from "@/hooks/use-chat-thread";
import { useE2eEngine } from "@/hooks/use-e2e-engine";
import { useDecryptedMessages } from "@/hooks/use-decrypted-messages";
import { isDecryptable } from "@/lib/e2e/decrypt-message";
import { parseAttachmentContent } from "@/lib/e2e/attachments/content";
import { Composer, type ComposerDraft } from "@/components/chat/composer";
import { ListingContextCard } from "@/components/chat/listing-context-card";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ImageGroup } from "@/components/chat/image-group";
import { groupImageMessages } from "@/lib/chat/group-images";
import type {
  ChatUserSummary,
  ListingContext,
  ThreadMessage,
} from "@/types/chat";

/** How long the opening loading block may wait on decryption. */
const DECRYPT_REVEAL_TIMEOUT_MS = 10_000;

/**
 * An encrypted-attachment message's plaintext is JSON (caption + per-file
 * keys); split it into the caption `body` and `e2eFiles` for the bubble.
 * Only messages the server lists `attachments` on are parsed.
 */
function withFiles(m: ThreadMessage, plaintext: string | null): ThreadMessage {
  if (!m.attachments?.length || plaintext === null)
    return plaintext === m.body ? m : { ...m, body: plaintext };
  const content = parseAttachmentContent(plaintext);
  if (!content) return { ...m, body: null };
  return { ...m, body: content.text ?? null, e2eFiles: content.attachments };
}

export function MessageThread({
  conversationId,
  peer,
  viewerId,
  canMessage,
  blockedByMe,
  listingId,
  listing,
  onBack,
  onConversationCreated,
}: {
  conversationId: string | null;
  peer: ChatUserSummary;
  viewerId: string;
  canMessage: boolean;
  blockedByMe: boolean;
  /** Attached to the FIRST message only — the "asking about this ad" card. */
  listingId?: string;
  listing?: ListingContext | null;
  onBack?: () => void;
  onConversationCreated?: (conversationId: string) => void;
}) {
  const t = useTranslations("Chat");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [listingSent, setListingSent] = useState(false);
  const [listingDismissed, setListingDismissed] = useState(false);
  // True while the listing preview is still pending a decision (send it, or
  // remove it) — gates both render spots below and the attach in handleSend.
  const showListingAttachment =
    Boolean(listingId) && !listingSent && !listingDismissed;

  const peerName = peer.username ?? t("unknownUser");

  const onMutated = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: chatKeys.inbox() });
    void queryClient.invalidateQueries({ queryKey: chatKeys.unread() });
  }, [queryClient]);

  const onSendError = useCallback(
    (message: string, status: number) => {
      // 429: POST /chats/messages is capped at 30/60s server-side (an
      // anti-harassment limit). The raw backend message is not user-facing
      // copy, and the failed send stays on screen with its own retry
      // affordance — so surface the reason and let the person retry manually
      // rather than looping into the same limit.
      if (status === 429) {
        toast.error(t("errors.rateLimited"));
        return;
      }
      // Fail-closed E2E markers from use-chat-thread (spec decision #6).
      if (message === "E2E_NO_KEYS") {
        toast.error(t("errors.e2eNoKeys"));
        return;
      }
      if (message === "E2E_UNAVAILABLE") {
        toast.error(t("errors.e2eUnavailable"));
        return;
      }
      // Block state is cached (see `withPeer` in chat-workspace); a 403 means
      // it changed, so re-resolve it to show the blocked banner.
      if (status === 403)
        void queryClient.invalidateQueries({
          queryKey: chatKeys.with(peer.id),
        });
      toast.error(
        status === 403
          ? t("composer.blockedError")
          : message || t("errors.sendFailed"),
      );
    },
    [t, queryClient, peer.id],
  );

  const thread = useChatThread({
    conversationId,
    recipientId: peer.id,
    viewerId,
    onConversationCreated,
    onMutated,
    onSendError,
  });

  const {
    messages,
    peerLastReadAt,
    isLoading,
    error,
    hasOlder,
    isLoadingOlder,
    loadOlder,
    send,
    retry,
    isSending,
    markActivity,
  } = thread;

  // ── E2E decrypt ──────────────────────────────────────────────────────────
  // Own optimistic echoes already carry plaintext; only server rows need
  // resolving. A still-bootstrapping or failed engine yields a null map —
  // we render a neutral placeholder, never the raw ciphertext.
  const e2eEngine = useE2eEngine(viewerId);
  const decrypted = useDecryptedMessages(messages, e2eEngine);

  // Server E2E rows with no decrypt outcome yet (engine bootstrapping, or
  // the batch is still running).
  const hasUndecrypted = messages.some(
    (m) => !m.tempId && isDecryptable(m) && !decrypted.has(m.id),
  );

  // The thread opens behind one loading block until its first page is fully
  // decrypted, then reveals everything at once — never a wall of per-bubble
  // "Decrypting…". Latched per mount (the thread remounts per conversation).
  // The timeout is the escape hatch for an engine that never comes up
  // (useE2eEngine stays null on bootstrap failure): the thread then opens
  // with per-bubble placeholders rather than a spinner forever.
  const [decryptTimedOut, setDecryptTimedOut] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const initialDecryptDone = !isLoading && !hasUndecrypted;
  if (!revealed && (initialDecryptDone || decryptTimedOut)) setRevealed(true);

  useEffect(() => {
    if (revealed) return;
    const timer = setTimeout(
      () => setDecryptTimedOut(true),
      DECRYPT_REVEAL_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [revealed]);

  const displayMessages = useMemo<ThreadMessage[]>(() => {
    if (!messages.some((m) => m.isE2e || m.attachments?.length))
      return messages;
    const out: ThreadMessage[] = [];
    for (const m of messages) {
      // Local optimistic / failed rows already hold the user's plaintext.
      if (m.tempId || !m.isE2e) {
        out.push(withFiles(m, m.body));
        continue;
      }
      const outcome = decrypted.get(m.id);
      if (outcome?.status === "ok") out.push(withFiles(m, outcome.plaintext));
      else if (outcome?.status === "unavailable")
        out.push({ ...m, body: t("message.notOnThisDevice") });
      else if (outcome?.status === "failed")
        out.push({ ...m, body: t("message.decryptFailed") });
      // Still decrypting. With a live engine, hold the row back — a new
      // message or an older page appears once decrypted (milliseconds).
      // Without one (bootstrap failed / timed out), show a neutral
      // placeholder — never the raw ciphertext.
      else if (!e2eEngine) out.push({ ...m, body: t("message.decrypting") });
    }
    return out;
  }, [messages, decrypted, e2eEngine, t]);

  // ── Scroll management ─────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const restoreOffsetRef = useRef<number | null>(null);
  const shownCountRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const handleLoadOlder = useCallback(() => {
    const el = scrollRef.current;
    // Anchor on distance-from-bottom so prepended history doesn't yank the
    // viewport to the top of the thread.
    restoreOffsetRef.current = el ? el.scrollHeight - el.scrollTop : null;
    loadOlder();
  }, [loadOlder]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // An older page is held back until decrypted, so only consume the anchor
    // once rows were actually added — not when the raw page merely arrived.
    const grew = displayMessages.length > shownCountRef.current;
    shownCountRef.current = displayMessages.length;
    if (restoreOffsetRef.current !== null) {
      if (!grew) return;
      el.scrollTop = el.scrollHeight - restoreOffsetRef.current;
      restoreOffsetRef.current = null;
      return;
    }
    if (atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [displayMessages, revealed]);

  const handleSend = useCallback(
    (draft: ComposerDraft) => {
      if (showListingAttachment) setListingSent(true);
      send({
        body: draft.body,
        draftKeys: draft.draftKeys,
        listingId: showListingAttachment ? listingId : undefined,
      });
    },
    [send, listingId, showListingAttachment],
  );

  const grouped = useMemo(() => {
    // First group by day.
    const dayBuckets: { day: string; items: ThreadMessage[] }[] = [];
    for (const message of displayMessages) {
      const day = dayKey(message.createdAt);
      const last = dayBuckets[dayBuckets.length - 1];
      if (last && last.day === day) last.items.push(message);
      else dayBuckets.push({ day, items: [message] });
    }
    // Then group consecutive image messages within each day.
    return dayBuckets.map((bucket) => ({
      day: bucket.day,
      nodes: groupImageMessages(bucket.items),
    }));
  }, [displayMessages]);

  // A 404 on a conversation route means "not a participant" — the backend
  // deliberately refuses to distinguish that from "no such thread", so we must
  // not render it as an access-denied message.
  if (error && isNotFound(error)) {
    return (
      <ThreadNotice
        icon={<MessageSquareOff className="size-8 text-muted-foreground" />}
        title={t("thread.notFoundTitle")}
        description={t("thread.notFoundDescription")}
        onBack={onBack}
        backLabel={t("thread.back")}
      />
    );
  }

  if (error) {
    return (
      <ThreadNotice
        icon={<ShieldAlert className="size-8 text-muted-foreground" />}
        title={t("errors.loadFailedTitle")}
        description={t("errors.loadFailed")}
        onBack={onBack}
        backLabel={t("thread.back")}
      />
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-3 sm:px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t("thread.back")}
            className="-ml-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted md:hidden"
          >
            <ArrowLeft className="size-5" />
          </button>
        )}
        <Avatar className="h-9 w-9 shrink-0">
          {peer.profilePhotoUrl && (
            <AvatarImage src={peer.profilePhotoUrl} alt={peerName} />
          )}
          <AvatarFallback className="font-semibold">
            {peerName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-none">
            {peerName}
          </p>
          {!canMessage && (
            <p className="mt-1 text-[11px] text-destructive">
              {blockedByMe ? t("thread.blockedByMe") : t("thread.blocked")}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex flex-1 flex-col gap-4 overflow-y-auto bg-background px-3 py-4 sm:px-4"
      >
        {isLoading ? (
          <ThreadSkeleton />
        ) : !revealed ? (
          <div
            role="status"
            className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
          >
            <Loader2 className="size-6 animate-spin" />
            <p className="text-xs">{t("message.decrypting")}</p>
          </div>
        ) : (
          <>
            {hasOlder && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleLoadOlder}
                  disabled={isLoadingOlder}
                >
                  {isLoadingOlder && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  {t("thread.loadOlder")}
                </Button>
              </div>
            )}

            {messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                {listing !== undefined && showListingAttachment && (
                  <div className="flex flex-col items-center gap-1.5">
                    <ListingContextCard listing={listing} />
                    <button
                      type="button"
                      onClick={() => setListingDismissed(true)}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {t("thread.removeListing")}
                    </button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {t("thread.emptyTitle", { name: peerName })}
                </p>
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.day} className="flex flex-col gap-4">
                <div className="flex justify-center">
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">
                    {format.dateTime(new Date(group.day), {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {group.nodes.map((node) =>
                  node.kind === "image-group" ? (
                    <ImageGroup
                      key={`group-${node.messages[0].id}`}
                      messages={node.messages}
                      isMine={node.senderId === viewerId}
                      onOpenImage={setLightbox}
                    />
                  ) : (
                    <MessageBubble
                      key={node.message.id}
                      message={node.message}
                      isMine={node.message.senderId === viewerId}
                      peerLastReadAt={peerLastReadAt}
                      peerName={peerName}
                      peerAvatarUrl={peer.profilePhotoUrl}
                      onRetry={retry}
                      onOpenImage={setLightbox}
                    />
                  ),
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pending listing context — shown until it rides out on the first
          send, or the buyer removes it before sending. */}
      {showListingAttachment && displayMessages.length > 0 && (
        <div className="shrink-0 border-t border-border bg-card px-3 py-2 sm:px-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {t("thread.attachingListing")}
            </p>
            <button
              type="button"
              onClick={() => setListingDismissed(true)}
              aria-label={t("thread.removeListing")}
              className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <ListingContextCard listing={listing ?? null} />
        </div>
      )}

      <Composer
        disabled={!canMessage}
        disabledReason={
          blockedByMe ? t("composer.blockedByMe") : t("composer.blocked")
        }
        sending={isSending}
        onSend={handleSend}
        onActivity={markActivity}
        hasListing={showListingAttachment}
      />

      <Dialog
        open={lightbox !== null}
        onOpenChange={(open) => !open && setLightbox(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("message.imageAlt")}</DialogTitle>
          </DialogHeader>
          {lightbox && (
            <div className="relative h-[70vh] w-full">
              <Image
                src={lightbox}
                alt={t("message.imageAlt")}
                fill
                sizes="100vw"
                className="object-contain"
                unoptimized
              />
            </div>
          )}
          {lightbox && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void saveFromUrl(lightbox).then(
                    (ok) => ok || toast.error(t("message.downloadFailed")),
                  )
                }
              >
                <Download className="size-4" />
                {t("message.download")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ThreadNotice({
  icon,
  title,
  description,
  onBack,
  backLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onBack?: () => void;
  backLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      {onBack && (
        <Button variant="outline" size="sm" onClick={onBack}>
          {backLabel}
        </Button>
      )}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "flex items-end gap-3",
            i % 2 === 0 ? "flex-row" : "flex-row-reverse",
          )}
        >
          {i % 2 === 0 && (
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          )}
          <Skeleton
            className={cn("h-11 rounded-2xl", i % 2 === 0 ? "w-52" : "w-40")}
          />
        </div>
      ))}
    </div>
  );
}
