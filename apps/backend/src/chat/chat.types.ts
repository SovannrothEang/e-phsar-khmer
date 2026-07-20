import type { MessageRow } from '../db/schema/chat.schema';
import type { ListingRow } from '../db/schema/listings.schema';
import type { PaginationMeta } from '../common/types/api-response.types';

export interface ChatUserSummary {
  id: string;
  username: string | null;
  profilePhotoUrl: string | null;
}

export interface ListingContext {
  id: string;
  title: string;
  price: string | null;
  currency: string;
  status: ListingRow['status'];
  thumbnailUrl: string | null;
}

export interface MessageWithListing extends MessageRow {
  listing: ListingContext | null;
}

export interface InboxItem {
  id: string;
  otherUser: ChatUserSummary | null;
  lastMessage: MessageRow | null;
  unreadCount: number;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface ConversationWithUser {
  conversation: InboxItem | null;
  otherUser: ChatUserSummary;
  blockedByMe: boolean;
  canMessage: boolean;
}

export interface ChatMessagesMeta extends PaginationMeta {
  /** Cursor of the newest message returned — the client's next `after` watermark. */
  latestCursor: string | null;
  /** max(readAt) of MY messages in this conversation — drives read receipts over polling. */
  peerLastReadAt: Date | null;
}
