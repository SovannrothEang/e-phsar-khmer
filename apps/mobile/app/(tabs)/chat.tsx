import RestoreHistoryModal from "@/components/chat/RestoreHistoryModal";
import SafeAreaView from "@/components/common/SafeAreaView";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/contexts/AuthContext";
import { useChatBackup, type ChatBackupState } from "@/hooks/use-chat-backup";
import {
  fetchChatMessages,
  fetchInbox,
  markChatRead,
  startConversationWith,
  type ChatMessage,
  type ChatUserSummary,
  type InboxItem,
} from "@/lib/api/chat";
import { decryptPage, type DecryptOutcome } from "@/lib/e2e/decrypt";
import { getE2eEngine } from "@/lib/e2e/device";
import { sendEncryptedText } from "@/lib/e2e/send";
import type { RatchetEngine } from "@/lib/e2e/types";
import { formatListingDate } from "@/lib/listings";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const POLL_MS = 3000;

interface ActiveThread {
  id: string;
  otherUser: ChatUserSummary;
  canMessage: boolean;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatListingDate(iso);
}

function makeClientMessageId(): string {
  const hex = (length: number) =>
    Array.from(
      { length },
      () => "0123456789abcdef"[Math.floor(Math.random() * 16)],
    ).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

function displayName(other: ChatUserSummary | null): string {
  return other?.username ? `@${other.username}` : "Seller";
}

function previewFor(item: InboxItem): string {
  const last = item.lastMessage;
  if (!last) return "No messages yet";
  if (!last.isE2e) return last.body ?? "Message";
  return "Encrypted message";
}

/**
 * The banner above a thread whose rows this device cannot read. A device that
 * already holds the backup key says plainly that the rows are not in the
 * backup — asking for the passcode again would only repeat the same result.
 */
function lockedBannerText(count: number, state: ChatBackupState): string {
  const noun = count === 1 ? "message" : "messages";
  switch (state.kind) {
    case "ready":
      return count === 1
        ? "1 message isn't in your backup — it was sent before this device joined and none of your devices had opened it."
        : `${count} messages aren't in your backup — they were sent before this device joined and none of your devices had opened them.`;
    case "restorable":
      return `${count} ${noun} locked on this device.`;
    case "no-passcode":
      return `${count} ${noun} can't be shown here: this account has no backup passcode. Set one on a device that has this history.`;
    case "no-backup":
      return `${count} ${noun} can't be shown here: no chat-history backup exists for this account.`;
    case "error":
      return `${count} ${noun} locked on this device. Could not check your chat backup.`;
    default:
      return `${count} ${noun} locked on this device.`;
  }
}

function avatarSource(other: ChatUserSummary | null) {
  if (other?.profilePhotoUrl) return { uri: other.profilePhotoUrl };
  return null;
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    userId?: string | string[];
    listingId?: string | string[];
  }>();
  const targetUserId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;
  const listingId = Array.isArray(params.listingId)
    ? params.listingId[0]
    : params.listingId;

  const { isAuthenticated, userId } = useAuth();

  const [engine, setEngine] = useState<RatchetEngine | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState<string | null>(null);

  const [thread, setThread] = useState<ActiveThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [decrypted, setDecrypted] = useState<Map<string, DecryptOutcome>>(
    new Map(),
  );
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [latestCursor, setLatestCursor] = useState<string | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const {
    state: backupState,
    restore: restoreBackup,
    pull: pullBackupSegments,
  } = useChatBackup(userId ?? null, engine?.deviceId ?? null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const openedFromParams = useRef(false);
  /** Messages already re-tried after a backup restore, per thread open. */
  const retriedDecrypt = useRef<Set<string>>(new Set());

  // ── E2E device bootstrap ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !userId) return;

    setEngineError(null);
    getE2eEngine(userId)
      .then((ready) => {
        if (!cancelled) setEngine(ready);
      })
      .catch(() => {
        if (!cancelled) {
          setEngineError("Could not prepare encrypted chat. Pull to retry.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  // ── Inbox ──────────────────────────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const page = await fetchInbox(undefined, 30);
      setInbox(page.items);
    } catch {
      setInboxError("Could not load your conversations.");
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && !thread) void loadInbox();
    }, [isAuthenticated, thread, loadInbox]),
  );

  // ── Thread loading and polling ─────────────────────────────────────────
  const decryptAndStore = useCallback(
    async (ready: RatchetEngine, rows: ChatMessage[]) => {
      const outcomes = await decryptPage(ready, rows);
      setDecrypted((current) => {
        const next = new Map(current);
        for (const [id, outcome] of outcomes) next.set(id, outcome);
        return next;
      });
      return outcomes;
    },
    [],
  );

  /**
   * A device that holds the backup key can still be missing segments another
   * device uploaded after its last pull. Fetch them before calling a row
   * unavailable — but never ask for the passcode here: the key is already on
   * this phone.
   */
  const retryWithBackup = useCallback(
    async (rows: ChatMessage[], outcomes: Map<string, DecryptOutcome>) => {
      if (!engine || backupState.kind !== "ready") return;
      const locked = rows.filter(
        (message) => outcomes.get(message.id)?.status !== "ok",
      );
      if (locked.length === 0) return;
      const restored = await pullBackupSegments();
      if (restored === 0) return;
      retriedDecrypt.current.clear();
      await decryptAndStore(engine, locked);
    },
    [engine, backupState.kind, pullBackupSegments, decryptAndStore],
  );

  const openThread = useCallback(
    async (next: ActiveThread) => {
      setThread(next);
      setThreadLoading(true);
      setThreadError(null);
      setSendError(null);
      setMessages([]);
      setDecrypted(new Map());
      setLatestCursor(null);
      setPeerLastReadAt(null);
      retriedDecrypt.current = new Set();

      // No engine yet: the thread view shows "Preparing encrypted chat…" and
      // the polling effect loads the page as soon as the engine arrives.
      if (!engine) return;

      try {
        const page = await fetchChatMessages(next.id, { limit: 30 });
        const ordered = [...page.items].reverse();
        setMessages(ordered);
        setLatestCursor(page.meta.latestCursor);
        setPeerLastReadAt(page.meta.peerLastReadAt);
        const outcomes = await decryptAndStore(engine, ordered);
        await markChatRead(next.id);
        setTimeout(
          () => scrollRef.current?.scrollToEnd({ animated: false }),
          80,
        );
        await retryWithBackup(ordered, outcomes);
      } catch {
        setThreadError("Could not load this conversation.");
      } finally {
        setThreadLoading(false);
      }
    },
    [engine, decryptAndStore, retryWithBackup],
  );

  // Open the thread requested by the listing detail's "Chat Now".
  useEffect(() => {
    if (!targetUserId || !engine || openedFromParams.current) return;
    openedFromParams.current = true;

    (async () => {
      try {
        const result = await startConversationWith(targetUserId);
        if (!result.conversation) {
          setInboxError("You cannot message this account.");
          return;
        }
        await openThread({
          id: result.conversation.id,
          otherUser: result.otherUser,
          canMessage: result.canMessage,
        });
      } catch {
        setInboxError("Could not open this conversation.");
      }
    })();
  }, [targetUserId, engine, openThread]);

  useEffect(() => {
    if (!thread || !engine) return;
    let cancelled = false;

    const poll = async () => {
      try {
        if (!latestCursor) {
          const page = await fetchChatMessages(thread.id, { limit: 30 });
          const ordered = [...page.items].reverse();
          if (cancelled) return;
          setMessages((current) => (current.length === 0 ? ordered : current));
          const outcomes = await decryptAndStore(engine, ordered);
          await markChatRead(thread.id);
          setLatestCursor(page.meta.latestCursor);
          setPeerLastReadAt(page.meta.peerLastReadAt);
          setThreadLoading(false);
          await retryWithBackup(ordered, outcomes);
          return;
        }
        const page = await fetchChatMessages(thread.id, {
          after: latestCursor,
          limit: 50,
        });
        if (cancelled) return;
        if (page.items.length > 0) {
          setMessages((current) => mergeMessages(current, page.items));
          await decryptAndStore(engine, page.items);
          await markChatRead(thread.id);
          setTimeout(
            () => scrollRef.current?.scrollToEnd({ animated: true }),
            80,
          );
        }
        setLatestCursor(page.meta.latestCursor ?? latestCursor);
        setPeerLastReadAt(page.meta.peerLastReadAt);
      } catch {
        /* transient poll failure — the next tick retries */
      }
    };

    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [thread, engine, latestCursor, decryptAndStore, retryWithBackup]);

  // Coming back from the backup screen: retry messages this device could not
  // decrypt once — the restored plaintext makes them readable now.
  useFocusEffect(
    useCallback(() => {
      if (!thread || !engine) return;
      const locked = messages.filter(
        (message) =>
          decrypted.get(message.id)?.status !== "ok" &&
          !retriedDecrypt.current.has(message.id),
      );
      if (locked.length === 0) return;
      for (const message of locked) retriedDecrypt.current.add(message.id);
      void decryptAndStore(engine, locked);
    }, [thread, engine, messages, decrypted, decryptAndStore]),
  );

  // ── Send ───────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !engine || !thread || sending) return;
    if (!thread.canMessage) {
      setSendError("Messaging is unavailable for this conversation.");
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const outcome = await sendEncryptedText(engine, {
        recipientId: thread.otherUser.id,
        plaintext: text,
        clientMessageId: makeClientMessageId(),
        ...(listingId && messages.length === 0 ? { listingId } : {}),
      });

      if (!outcome.ok) {
        setSendError(outcome.message);
        return;
      }

      setDraft("");
      const local: ChatMessage = {
        id: outcome.messageId,
        conversationId: outcome.conversationId,
        senderId: userId ?? "",
        body: null,
        listingId: listingId && messages.length === 0 ? listingId : null,
        imageUrl: null,
        imagePath: null,
        groupId: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        isE2e: true,
        e2eHeader: null,
        e2eVersion: 2,
        senderDeviceId: engine.deviceId,
      };
      setMessages((current) => [...current, local]);
      setDecrypted((current) =>
        new Map(current).set(local.id, { status: "ok", plaintext: text }),
      );
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setSendError("Could not send the message.");
    } finally {
      setSending(false);
    }
  };

  const unavailableCount = messages.filter(
    (message) => decrypted.get(message.id)?.status === "unavailable",
  ).length;
  const lockedBanner =
    unavailableCount > 0 ? lockedBannerText(unavailableCount, backupState) : "";

  if (!isAuthenticated) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-background">
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="chatbubbles-outline" size={44} color="#9CA3AF" />
          <Text className="mt-3 text-center text-neutral-text-sub">
            Sign in to see your messages.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/sign-in")}
            className="mt-4 rounded-lg bg-secondary-orange px-8 py-3"
          >
            <Text className="font-bold text-white">Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Thread view ────────────────────────────────────────────────────────
  if (thread) {
    return (
      <SafeAreaView
        statusBarColor={Colors.primary.DEFAULT}
        statusBarStyle="light-content"
        className="flex-1 bg-neutral-background"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <View className="flex-row items-center gap-3 bg-primary px-4 py-3">
            <TouchableOpacity onPress={() => setThread(null)}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/20">
              {avatarSource(thread.otherUser) ? (
                <Image
                  source={avatarSource(thread.otherUser)!}
                  className="h-full w-full"
                />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {displayName(thread.otherUser)
                    .replace("@", "")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-white">
                {displayName(thread.otherUser)}
              </Text>
              {!thread.canMessage && (
                <Text className="text-[11px] text-white/80">
                  Messaging unavailable
                </Text>
              )}
            </View>
          </View>

          {unavailableCount > 0 && !threadLoading && (
            <View className="flex-row items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
              <Ionicons
                name={
                  backupState.kind === "ready"
                    ? "archive-outline"
                    : "lock-closed-outline"
                }
                size={15}
                color="#B45309"
              />
              <Text className="flex-1 text-xs leading-4 text-amber-800">
                {lockedBanner}
              </Text>
              {backupState.kind === "restorable" && (
                <TouchableOpacity onPress={() => setRestoreOpen(true)}>
                  <Text className="text-xs font-bold text-amber-900">
                    Restore
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {restoreNotice && (
            <View className="border-b border-emerald-200 bg-emerald-50 px-4 py-2">
              <Text className="text-xs text-emerald-800">{restoreNotice}</Text>
            </View>
          )}

          {!engine ? (
            <View className="flex-1 items-center justify-center px-6">
              {engineError ? (
                <>
                  <Text className="text-center text-neutral-text-sub">
                    {engineError}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEngineError(null);
                      if (userId) {
                        getE2eEngine(userId)
                          .then(setEngine)
                          .catch(() =>
                            setEngineError("Could not prepare encrypted chat."),
                          );
                      }
                    }}
                    className="mt-3 rounded-lg border border-primary px-5 py-2"
                  >
                    <Text className="font-bold text-primary">Retry</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ActivityIndicator color={Colors.primary.DEFAULT} />
                  <Text className="mt-3 text-sm text-neutral-text-sub">
                    Preparing encrypted chat…
                  </Text>
                </>
              )}
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              className="flex-1 px-4 pt-3"
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: false })
              }
            >
              {threadLoading ? (
                <View className="items-center py-6">
                  <ActivityIndicator color={Colors.primary.DEFAULT} />
                </View>
              ) : threadError ? (
                <Text className="py-6 text-center text-sm text-neutral-text-sub">
                  {threadError}
                </Text>
              ) : messages.length === 0 ? (
                <Text className="py-6 text-center text-sm text-neutral-text-sub">
                  Say hello — messages are end-to-end encrypted.
                </Text>
              ) : (
                messages.map((message) => {
                  const mine = message.senderId === userId;
                  const outcome = decrypted.get(message.id);
                  const text =
                    outcome?.status === "ok"
                      ? outcome.plaintext
                      : outcome?.status === "failed"
                        ? "Could not decrypt this message."
                        : backupState.kind === "ready"
                          ? "Not in your backup — sent before this device joined and none of your devices had opened it."
                          : mine
                            ? "Sent from another device — this phone has no key for it."
                            : "Encrypted message — not available on this device.";
                  const seen =
                    mine &&
                    peerLastReadAt !== null &&
                    new Date(message.createdAt).getTime() <=
                      new Date(peerLastReadAt).getTime();

                  return (
                    <View
                      key={message.id}
                      className={`mb-2 max-w-[82%] ${
                        mine ? "self-end items-end" : "self-start items-start"
                      }`}
                    >
                      {message.listingId && (
                        <TouchableOpacity
                          onPress={() =>
                            router.push(
                              `/product/${message.listingId}` as never,
                            )
                          }
                          className="mb-1 rounded-lg border border-neutral-border bg-white px-3 py-2"
                        >
                          <Text className="text-[11px] font-semibold text-primary">
                            Listing context
                          </Text>
                          <Text className="text-[11px] text-neutral-text-sub">
                            Tap to view the ad
                          </Text>
                        </TouchableOpacity>
                      )}
                      <View
                        className={`rounded-2xl px-3.5 py-2.5 ${
                          mine
                            ? "rounded-br-sm bg-primary"
                            : "rounded-bl-sm bg-white"
                        }`}
                      >
                        <Text
                          className={
                            mine
                              ? "text-[15px] leading-5 text-white"
                              : "text-[15px] leading-5 text-neutral-text-main"
                          }
                        >
                          {text}
                        </Text>
                      </View>
                      <Text className="mt-0.5 text-[10px] text-neutral-text-muted">
                        {relativeTime(message.createdAt)}
                        {seen ? " · Seen" : ""}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {sendError && (
            <Text className="bg-red-50 px-4 py-2 text-xs text-red-600">
              {sendError}
            </Text>
          )}

          <View className="flex-row items-end gap-2 border-t border-neutral-border bg-white px-3 py-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={Colors.text.muted}
              multiline
              maxLength={2000}
              editable={Boolean(engine) && thread.canMessage}
              className="max-h-28 flex-1 rounded-2xl bg-neutral-background px-4 py-2.5 text-base text-neutral-text-main"
            />
            <TouchableOpacity
              onPress={() => void handleSend()}
              disabled={!engine || sending || !draft.trim()}
              className={`h-11 w-11 items-center justify-center rounded-full ${
                draft.trim() ? "bg-primary" : "bg-neutral-border"
              }`}
            >
              {sending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <RestoreHistoryModal
          visible={restoreOpen}
          onClose={() => setRestoreOpen(false)}
          onSubmit={restoreBackup}
          onRestored={(restored) => {
            setRestoreOpen(false);
            retriedDecrypt.current.clear();
            if (engine) {
              const locked = messages.filter(
                (message) => decrypted.get(message.id)?.status !== "ok",
              );
              if (locked.length > 0) void decryptAndStore(engine, locked);
            }
            setRestoreNotice(
              restored > 0
                ? `Restored ${restored} message${
                    restored === 1 ? "" : "s"
                  } from your backup.`
                : "The backup had nothing to restore yet. Locked messages stay unavailable.",
            );
            setTimeout(() => setRestoreNotice(null), 6000);
          }}
        />
      </SafeAreaView>
    );
  }

  // ── Inbox view ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      statusBarColor={Colors.primary.DEFAULT}
      statusBarStyle="light-content"
      className="flex-1 bg-neutral-background"
    >
      <View className="bg-primary px-4 py-4">
        <Text className="text-xl font-bold text-white">Chats</Text>
      </View>

      {inboxLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary.DEFAULT} />
        </View>
      ) : inboxError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-neutral-text-sub">
            {inboxError}
          </Text>
          <TouchableOpacity
            onPress={() => void loadInbox()}
            className="mt-3 rounded-lg border border-primary px-5 py-2"
          >
            <Text className="font-bold text-primary">Try again</Text>
          </TouchableOpacity>
        </View>
      ) : inbox.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="chatbubbles-outline" size={44} color="#9CA3AF" />
          <Text className="mt-3 text-center text-neutral-text-sub">
            No conversations yet. Message a seller from any ad.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {inbox.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() =>
                void openThread({
                  id: item.id,
                  otherUser: item.otherUser ?? {
                    id: "",
                    username: null,
                    profilePhotoUrl: null,
                  },
                  canMessage: Boolean(item.otherUser),
                })
              }
              className="flex-row items-center gap-3 border-b border-neutral-border/60 bg-white px-4 py-3"
            >
              <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                {avatarSource(item.otherUser) ? (
                  <Image
                    source={avatarSource(item.otherUser)!}
                    className="h-full w-full"
                  />
                ) : (
                  <Text className="text-base font-bold text-primary">
                    {displayName(item.otherUser)
                      .replace("@", "")
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-neutral-text-main">
                    {displayName(item.otherUser)}
                  </Text>
                  <Text className="text-[11px] text-neutral-text-muted">
                    {relativeTime(item.lastMessageAt)}
                  </Text>
                </View>
                <View className="mt-0.5 flex-row items-center justify-between">
                  <Text
                    className="mr-2 flex-1 text-xs text-neutral-text-sub"
                    numberOfLines={1}
                  >
                    {previewFor(item)}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View className="min-w-5 items-center rounded-full bg-secondary-orange px-1.5 py-0.5">
                      <Text className="text-[10px] font-bold text-white">
                        {item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const seen = new Set(current.map((message) => message.id));
  const additions = incoming.filter((message) => !seen.has(message.id));
  return additions.length > 0 ? [...current, ...additions] : current;
}
