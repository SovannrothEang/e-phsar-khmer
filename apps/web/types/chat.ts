/**
 * Wire types for the chat API (`/api/v1/chats/*`). These mirror
 * `apps/backend/src/chat/chat.types.ts`, with `Date` columns narrowed to the
 * ISO strings they arrive as over JSON.
 */

export type ListingStatus = "draft" | "active" | "expired" | "deleted";

export interface ChatUserSummary {
  id: string;
  username: string | null;
  profilePhotoUrl: string | null;
}

/** Listing context card attached to a message. Null when the ad was deleted. */
export interface ListingContext {
  id: string;
  title: string;
  price: string | null;
  currency: string;
  status: ListingStatus;
  thumbnailUrl: string | null;
}

/**
 * Signal-protocol envelope carried alongside an E2E message. Mirrors
 * `E2eHeader` in `apps/backend/src/db/schema/chat.schema.ts`. `body` on
 * such a message is ciphertext, not plaintext.
 */
export interface E2eHeader {
  v: 1;
  dh: string;
  pn: number;
  n: number;
  identityKey?: string;
  ephemeralKey?: string;
  oneTimePrekeyId?: number;
  signedPrekeyId?: number;
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
  readAt: string | null;
  createdAt: string;
  isE2e: boolean;
  e2eHeader: E2eHeader | null;
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
  /** I blocked them — distinct from "they blocked me", which we never reveal. */
  blockedByMe: boolean;
  /** False when a block exists in EITHER direction; the composer must lock. */
  canMessage: boolean;
}

export interface ChatPaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface ChatMessagesMeta extends ChatPaginationMeta {
  /** Cursor of the newest message returned — the next `after` watermark. */
  latestCursor: string | null;
  /** max(readAt) over MY messages; drives read receipts. */
  peerLastReadAt: string | null;
}

export interface InboxPage {
  items: InboxItem[];
  meta: ChatPaginationMeta;
}

export interface MessagePage {
  items: ChatMessage[];
  meta: ChatMessagesMeta;
}

export interface SendMessageInput {
  recipientId: string;
  body?: string;
  listingId?: string;
  imagePath?: string;
  groupId?: string;
  e2eHeader?: E2eHeader;
  /**
   * Stable client-minted dedup key. Mint once per logical send (optimistic
   * echo / draft) and reuse on every retry so a lost response or double-tap
   * replays the original row instead of inserting twice.
   */
  clientMessageId?: string;
}

export interface SendMessageResult {
  conversationId: string;
  message: ChatMessage;
}

/**
 * Discriminated result used by every chat server action. Server actions cannot
 * throw structured errors across the RSC boundary (the message is scrubbed in
 * production), so the HTTP status travels back in the payload — the UI needs
 * it to tell 404 "not a participant" from 403 "messaging unavailable".
 */
export type ChatActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

/**
 * A message plus the client-only state an optimistic send needs. `pending`
 * marks an echo the server has not confirmed; `failed` keeps a rejected send
 * on screen with a retry affordance instead of silently dropping it.
 */
export interface ThreadMessage extends ChatMessage {
  pending?: boolean;
  failed?: boolean;
  /** Local correlation id for the optimistic echo (temp rows only). */
  tempId?: string;
  /**
   * Dedup key for this logical send — minted with the optimistic echo and
   * kept across retries so `POST /chats/messages` can replay instead of
   * duplicating. Client-only; not part of the server message wire type.
   */
  clientMessageId?: string;
}
