import { apiFetch, type ApiMeta } from "@/lib/api/client";
import type { E2eEnvelope, E2eHeader, E2eV2Payload } from "@/lib/e2e/types";

export interface ChatUserSummary {
  id: string;
  username: string | null;
  profilePhotoUrl: string | null;
  lastSeenAt?: string | null;
}

export interface ListingContext {
  id: string;
  title: string;
  price: string | null;
  currency: string;
  status: string;
  thumbnailUrl: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  listingId: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  groupId: string | null;
  clientMessageId?: string | null;
  readAt: string | null;
  createdAt: string;
  isE2e: boolean;
  e2eHeader: E2eHeader | null;
  e2eVersion?: number | null;
  senderDeviceId?: string | null;
  envelopes?: E2eEnvelope[];
  listing?: ListingContext | null;
}

export interface InboxItem {
  id: string;
  otherUser: ChatUserSummary | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface ConversationWithUser {
  conversation: InboxItem | null;
  otherUser: ChatUserSummary;
  blockedByMe: boolean;
  canMessage: boolean;
}

export interface MessagePageMeta extends ApiMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  latestCursor: string | null;
  peerLastReadAt: string | null;
}

export interface MessagePage {
  items: ChatMessage[];
  meta: MessagePageMeta;
}

export interface SendChatMessageInput {
  recipientId: string;
  body: string;
  e2e: E2eV2Payload;
  clientMessageId?: string;
  listingId?: string;
}

export interface SendChatMessageResult {
  conversationId: string;
  message: ChatMessage;
}

export async function fetchInbox(
  cursor?: string,
  limit = 20,
): Promise<{
  items: InboxItem[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (cursor) search.set("cursor", cursor);
  const { data, meta } = await apiFetch<InboxItem[]>(
    `/chats?${search.toString()}`,
  );
  return {
    items: data ?? [],
    nextCursor: (meta?.nextCursor as string | null) ?? null,
    hasMore: Boolean(meta?.hasMore),
  };
}

export async function fetchChatUnreadCount(): Promise<number> {
  const { data } = await apiFetch<{ total: number }>("/chats/unread-count");
  return data?.total ?? 0;
}

export async function fetchConversationWith(
  userId: string,
): Promise<ConversationWithUser> {
  const { data } = await apiFetch<ConversationWithUser>(
    `/chats/with/${encodeURIComponent(userId)}`,
  );
  return data;
}

/** Find-or-create the thread with a user (the "Chat Now" path). */
export async function startConversationWith(
  userId: string,
): Promise<ConversationWithUser> {
  const { data } = await apiFetch<ConversationWithUser>(
    `/chats/with/${encodeURIComponent(userId)}`,
    { method: "POST" },
  );
  return data;
}

export async function sendChatMessage(
  input: SendChatMessageInput,
): Promise<SendChatMessageResult> {
  const { data } = await apiFetch<SendChatMessageResult>("/chats/messages", {
    method: "POST",
    body: input,
  });
  return data;
}

export async function fetchChatMessages(
  conversationId: string,
  options: { cursor?: string; after?: string; limit?: number } = {},
): Promise<MessagePage> {
  const search = new URLSearchParams({ limit: String(options.limit ?? 30) });
  if (options.cursor) search.set("cursor", options.cursor);
  if (options.after) search.set("after", options.after);
  const { data, meta } = await apiFetch<ChatMessage[]>(
    `/chats/${encodeURIComponent(conversationId)}/messages?${search.toString()}`,
  );
  const pageMeta = (meta ?? {}) as Partial<MessagePageMeta>;
  return {
    items: data ?? [],
    meta: {
      nextCursor: pageMeta.nextCursor ?? null,
      hasMore: Boolean(pageMeta.hasMore),
      limit: Number(pageMeta.limit ?? 30),
      latestCursor: pageMeta.latestCursor ?? null,
      peerLastReadAt: pageMeta.peerLastReadAt ?? null,
    },
  };
}

export async function markChatRead(conversationId: string): Promise<void> {
  await apiFetch<{ marked: number }>(
    `/chats/${encodeURIComponent(conversationId)}/read`,
    { method: "POST" },
  );
}
