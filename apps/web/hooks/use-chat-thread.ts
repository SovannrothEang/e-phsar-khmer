"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchMessages,
  markConversationRead,
  sendChatMessage,
  signChatUpload,
} from "@/actions/chat";
import { chatKeys, unwrap } from "@/lib/chat/queries";
import { mergeMessages } from "@/lib/chat/format";
import { useAdaptivePolling } from "@/hooks/use-chat-polling";
import { useChatWs } from "@/hooks/use-chat-ws";
import {
  getDraftFile,
  getDraftPreviewUrl,
  removeDraftImage,
} from "@/lib/chat-draft-images";
import { getE2eEngine } from "@/lib/e2e/engine-provider";
import { sendE2eText } from "@/lib/e2e/send-encrypt";
import type {
  ChatMessage,
  MessagePage,
  SendMessageInput,
  ThreadMessage,
} from "@/types/chat";

const PAGE_SIZE = 30;
const MARK_READ_DEBOUNCE_MS = 700;

/** Monotonic max over two ISO timestamps (read receipts). */
function newerIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Advance the poll watermark. `latestCursor` is an opaque base64 cursor, NOT a
 * timestamp, so it cannot be compared — but the server only ever returns one
 * that is at or ahead of the cursor we sent (empty deltas echo ours back).
 * The only rule that matters: a null must never clobber a stored watermark.
 */
function advanceWatermark(
  current: string | null,
  next: string | null,
): string | null {
  return next ?? current;
}

export interface SendDraft {
  body?: string;
  /** Draft-image registry keys — uploaded to Supabase at send-time. */
  draftKeys?: string[];
  listingId?: string;
}

export interface ChatThread {
  messages: ThreadMessage[];
  peerLastReadAt: string | null;
  isLoading: boolean;
  error: unknown;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  loadOlder: () => void;
  send: (draft: SendDraft) => void;
  retry: (message: ThreadMessage) => void;
  isSending: boolean;
  markActivity: () => void;
  wsConnected: boolean;
}

/**
 * Live thread state: a paginated history page-set, a delta poll on top of it,
 * and the optimistic echoes of anything sent this session.
 *
 * Watermark discipline — the part that breaks subtly if you get it wrong:
 * `meta.latestCursor` is kept in a ref and only ever advanced. The backend's
 * empty-delta fast path echoes the client's own cursor back, and other empty
 * responses can carry `latestCursor: null`; overwriting the stored watermark
 * with null would re-request the whole thread on every subsequent poll.
 */
export function useChatThread({
  conversationId,
  recipientId,
  viewerId,
  enabled = true,
  onConversationCreated,
  onMutated,
  onSendError,
}: {
  conversationId: string | null;
  recipientId: string | null;
  viewerId: string | null;
  enabled?: boolean;
  onConversationCreated?: (conversationId: string) => void;
  onMutated?: () => void;
  onSendError?: (message: string, status: number) => void;
}): ChatThread {
  const queryClient = useQueryClient();
  const polling = useAdaptivePolling(enabled && conversationId !== null);
  const { markActivity, isVisible, refetchInterval } = polling;

  // Refs, not state: these are read inside queryFns, and writing them must
  // never trigger a render on its own.
  const watermarkRef = useRef<string | null>(null);
  const peerReadRef = useRef<string | null>(null);
  const deltaStoreRef = useRef<ChatMessage[]>([]);
  const ackedMessageIdRef = useRef<string | null>(null);

  const [local, setLocal] = useState<ThreadMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  // ── WebSocket ────────────────────────────────────────────────────────────
  const wsEnabled = enabled && conversationId !== null;
  const handleWsMessage = useCallback(
    (msg: ChatMessage) => {
      if (msg.conversationId !== conversationId) return;
      // Merge into local state — deduped against server messages in `messages`.
      setLocal((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, { ...msg, pending: false, failed: false }];
      });
      markActivity();
    },
    [conversationId, markActivity],
  );
  const ws = useChatWs({ enabled: wsEnabled, onMessage: handleWsMessage });

  // ── History (initial page + upward pagination) ────────────────────────────
  const history = useInfiniteQuery({
    queryKey: chatKeys.thread(conversationId ?? "none"),
    enabled: enabled && conversationId !== null,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<MessagePage> => {
      const page = unwrap(
        await fetchMessages(conversationId as string, {
          cursor: pageParam ?? undefined,
          limit: PAGE_SIZE,
        }),
      );
      // Seed the poll watermark from the newest page only, and only once.
      if (pageParam === null) {
        watermarkRef.current = advanceWatermark(
          watermarkRef.current,
          page.meta.latestCursor,
        );
        peerReadRef.current = newerIso(
          peerReadRef.current,
          page.meta.peerLastReadAt,
        );
      }
      return page;
    },
    getNextPageParam: (last) => last.meta.nextCursor,
    staleTime: Infinity,
  });

  // ── Delta poll ────────────────────────────────────────────────────────────
  // While the WebSocket is connected it delivers messages in real-time, so the
  // interval stops. The query itself stays enabled: pushes published while
  // the socket was down (reconnect gap, server restart) are never replayed,
  // so a one-shot delta on every (re)connect and on window focus is what
  // closes that gap — otherwise the thread silently misses messages the
  // inbox already shows.
  const wsConnected = ws.isConnected;
  const delta = useQuery({
    queryKey: [...chatKeys.thread(conversationId ?? "none"), "delta"],
    enabled: enabled && conversationId !== null && history.isSuccess,
    refetchInterval: wsConnected ? false : refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const page = unwrap(
        await fetchMessages(conversationId as string, {
          // No watermark yet (brand-new or empty thread) → fall back to
          // history mode, which also establishes the watermark.
          after: watermarkRef.current ?? undefined,
          limit: PAGE_SIZE,
        }),
      );
      watermarkRef.current = advanceWatermark(
        watermarkRef.current,
        page.meta.latestCursor,
      );
      peerReadRef.current = newerIso(
        peerReadRef.current,
        page.meta.peerLastReadAt,
      );
      if (page.items.length > 0) {
        deltaStoreRef.current = mergeMessages(
          deltaStoreRef.current,
          page.items,
        );
      }
      return {
        messages: deltaStoreRef.current,
        peerLastReadAt: peerReadRef.current,
      };
    },
  });

  const { refetch: refetchDelta } = delta;
  useEffect(() => {
    if (wsConnected && history.isSuccess) void refetchDelta();
  }, [wsConnected, history.isSuccess, refetchDelta]);

  const serverMessages = useMemo(() => {
    const historyItems = (history.data?.pages ?? []).flatMap((p) => p.items);
    return mergeMessages(historyItems, delta.data?.messages ?? []);
  }, [history.data, delta.data]);

  const messages = useMemo<ThreadMessage[]>(() => {
    const serverIds = new Set(serverMessages.map((m) => m.id));
    // Drop optimistic echoes the server has already handed back to us.
    const extras = local.filter((m) => !serverIds.has(m.id));
    return [...serverMessages, ...extras];
  }, [serverMessages, local]);

  const peerLastReadAt =
    delta.data?.peerLastReadAt ??
    history.data?.pages[0]?.meta.peerLastReadAt ??
    null;

  // ── Mark-read (debounced) ─────────────────────────────────────────────────
  // Fires only while the tab is visible and only when the newest inbound
  // message is one we have not acknowledged yet — never on every render.
  const newestInbound = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (viewerId && m.senderId !== viewerId) return m;
    }
    return null;
  }, [messages, viewerId]);

  const ackCandidateId =
    conversationId !== null &&
    isVisible &&
    newestInbound !== null &&
    newestInbound.readAt === null
      ? newestInbound.id
      : null;

  useEffect(() => {
    if (!ackCandidateId || !conversationId) return;
    // The "already acknowledged?" test lives here rather than in the render
    // body: ackedMessageIdRef is a ref, and reading a ref during render is
    // unsafe under concurrent rendering, where a render can be discarded and
    // replayed. Effects see the committed value.
    if (ackedMessageIdRef.current === ackCandidateId) return;
    const timer = window.setTimeout(() => {
      ackedMessageIdRef.current = ackCandidateId;
      void markConversationRead(conversationId).then((res) => {
        if (res.ok && res.data.marked > 0) {
          void queryClient.invalidateQueries({ queryKey: chatKeys.inbox() });
          void queryClient.invalidateQueries({ queryKey: chatKeys.unread() });
        }
      });
    }, MARK_READ_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [ackCandidateId, conversationId, queryClient]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const dispatch = useCallback(
    async (draft: SendDraft, tempId: string, clientMessageId: string) => {
      if (!recipientId || !viewerId) return;
      setIsSending(true);

      const draftKeys = draft.draftKeys ?? [];
      const imageCount = draftKeys.length;
      const hasBody = !!draft.body;

      // Generate a shared groupId for all images in this batch.
      const groupId = imageCount > 0 ? crypto.randomUUID() : undefined;

      // Upload and send each image via HTTP (returns full message with imageUrl).
      for (let i = 0; i < imageCount; i++) {
        const key = draftKeys[i];
        try {
          const file = getDraftFile(key);
          if (!file) continue;
          const ext = file.type.split("/")[1] ?? "jpg";
          const filename = `chat-image-${Date.now()}-${i}.${ext}`;
          const signed = await signChatUpload(filename);
          if (!signed.ok) throw new Error(signed.message);
          const uploadRes = await fetch(signed.data.signedUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });
          if (!uploadRes.ok) throw new Error("Upload failed");

          // Always use HTTP for images — returns full message with imageUrl.
          // Per-image dedup key: one logical draft → many rows; index i keeps
          // retries of the same draft from re-inserting a delivered image.
          const input: SendMessageInput = {
            recipientId,
            imagePath: signed.data.path,
            groupId,
            listingId: i === 0 ? draft.listingId : undefined,
            clientMessageId: `${clientMessageId}-img-${i}`,
          };
          const sendRes = await sendChatMessage(input);
          if (!sendRes.ok) throw new Error(sendRes.message);

          // Replace optimistic with server message.
          setLocal((prev) => [
            ...prev.filter((m) => m.tempId !== tempId),
            { ...sendRes.data.message, pending: false, failed: false },
          ]);

          // Cleanup this key after successful upload+send.
          removeDraftImage(key);
        } catch {
          // Upload/send failed — mark as failed, keep remaining drafts.
          setIsSending(false);
          setLocal((prev) =>
            prev.map((m) =>
              m.tempId === tempId ? { ...m, pending: false, failed: true } : m,
            ),
          );
          onSendError?.("Image upload failed", 0);
          return;
        }
      }

      // Send text body as final message (if any).
      // Always E2E for text (spec decision #6 — fail closed, no plaintext
      // fallback). sendE2eText runs encrypt → HTTP → session commit under
      // one per-conversation lock and never uses the WS envelope, because
      // the commit needs conversationId + message.id from the HTTP response.
      if (hasBody) {
        const engine = await getE2eEngine(viewerId).catch(() => null);
        const outcome = await sendE2eText(engine, {
          conversationId,
          recipientId,
          plaintext: draft.body as string,
          listingId: imageCount === 0 ? draft.listingId : undefined,
          clientMessageId,
          send: sendChatMessage,
        });
        setIsSending(false);

        if (!outcome.ok) {
          setLocal((prev) =>
            prev.map((m) =>
              m.tempId === tempId ? { ...m, pending: false, failed: true } : m,
            ),
          );
          if (outcome.reason === "no-recipient-keys") {
            onSendError?.("E2E_NO_KEYS", 404);
          } else if (outcome.reason === "engine-unavailable") {
            onSendError?.("E2E_UNAVAILABLE", 0);
          } else if (outcome.reason === "send-failed") {
            onSendError?.(outcome.message, outcome.status);
          } else {
            onSendError?.("E2E_UNAVAILABLE", 0);
          }
          return;
        }

        // Replace the optimistic echo with the server row. Override body
        // with the plaintext we already know — the server copy is ciphertext,
        // and rendering it for one frame before the decrypt hook runs would
        // flash base64 at the user. History refetches re-resolve via the
        // decrypt cache (committed inside sendE2eText).
        setLocal((prev) => [
          ...prev.filter((m) => m.tempId !== tempId),
          {
            ...outcome.result.message,
            body: draft.body ?? null,
            pending: false,
            failed: false,
          },
        ]);
        if (conversationId === null) {
          onConversationCreated?.(outcome.result.conversationId);
        }
        onMutated?.();
        return;
      }

      // No body — all images sent, clean up optimistic echo.
      setIsSending(false);
      setLocal((prev) => prev.filter((m) => m.tempId !== tempId));
      onMutated?.();
    },
    [
      recipientId,
      viewerId,
      conversationId,
      onConversationCreated,
      onMutated,
      onSendError,
    ],
  );

  const send = useCallback(
    (draft: SendDraft) => {
      if (!recipientId || !viewerId) return;
      markActivity();
      const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      // Minted once per logical send; reused on every retry so a lost
      // response / double-tap replays instead of inserting twice.
      const clientMessageId = crypto.randomUUID();

      // Object URLs from the draft registry for the optimistic preview.
      const previewUrls: string[] = [];
      for (const key of draft.draftKeys ?? []) {
        const url = getDraftPreviewUrl(key);
        if (url) previewUrls.push(url);
      }

      // Create optimistic echo — first image shows preview, text shows body.
      const optimistic: ThreadMessage = {
        id: tempId,
        tempId,
        clientMessageId,
        conversationId: conversationId ?? "",
        senderId: viewerId,
        body: draft.body ?? null,
        listingId: draft.listingId ?? null,
        imageUrl: previewUrls[0] ?? null,
        imagePath: null,
        groupId: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        isE2e: false,
        e2eHeader: null,
        pending: true,
      };
      setLocal((prev) => [...prev, optimistic]);
      void dispatch(draft, tempId, clientMessageId);
    },
    [recipientId, viewerId, conversationId, dispatch, markActivity],
  );

  const retry = useCallback(
    (message: ThreadMessage) => {
      if (!message.tempId) return;
      const clientMessageId = message.clientMessageId ?? crypto.randomUUID();
      setLocal((prev) =>
        prev.map((m) =>
          m.tempId === message.tempId
            ? { ...m, pending: true, failed: false, clientMessageId }
            : m,
        ),
      );
      // Retry with existing imagePath (already uploaded) or no image (upload failed).
      // Draft keys are lost after failure — user must re-attach if upload failed.
      void dispatch(
        {
          body: message.body ?? undefined,
          listingId: message.listingId ?? undefined,
        },
        message.tempId,
        clientMessageId,
      );
    },
    [dispatch],
  );

  return {
    messages,
    peerLastReadAt,
    isLoading: conversationId !== null && history.isPending,
    error: history.error,
    hasOlder: history.hasNextPage,
    isLoadingOlder: history.isFetchingNextPage,
    loadOlder: () => void history.fetchNextPage(),
    send,
    retry,
    isSending,
    markActivity,
    wsConnected,
  };
}
