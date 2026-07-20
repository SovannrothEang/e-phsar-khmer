import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  max,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { conversations, messages } from '../db/schema/chat.schema';
import type { ConversationRow, MessageRow } from '../db/schema/chat.schema';
import { listingPhotos, listings } from '../db/schema/listings.schema';
import { userBlocks, users } from '../db/schema/users.schema';
import { SupabaseService } from '../common/supabase/supabase.service';
import type { PaginationMeta } from '../common/types/api-response.types';
import type { SendMessageDto } from './dto/send-message.dto';
import type { QueryChatsDto } from './dto/query-chats.dto';
import type { QueryMessagesDto } from './dto/query-messages.dto';
import type {
  ChatMessagesMeta,
  ChatUserSummary,
  ConversationWithUser,
  InboxItem,
  ListingContext,
  MessageWithListing,
} from './chat.types';

@Injectable()
export class ChatService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get bucket(): string {
    return (
      this.configService.get<string>('supabase.storageBucket') ?? 'listings'
    );
  }

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<{ conversationId: string; message: MessageWithListing }> {
    if (dto.recipientId === senderId)
      throw new BadRequestException('Cannot message yourself');
    if (!dto.body && !dto.imagePath)
      throw new BadRequestException('Message must contain text or an image');
    if (
      dto.imagePath &&
      (!dto.imagePath.startsWith(`chat/${senderId}/`) ||
        dto.imagePath.includes('..'))
    )
      throw new BadRequestException('Invalid image path');

    const [recipient] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, dto.recipientId), isNull(users.deletedAt)))
      .limit(1);
    if (!recipient) throw new NotFoundException('Recipient not found');

    if (await this.isBlockedEitherWay(senderId, dto.recipientId))
      throw new ForbiddenException('Messaging unavailable');

    if (dto.listingId) {
      const [listing] = await this.db
        .select({ id: listings.id, userId: listings.userId })
        .from(listings)
        .where(eq(listings.id, dto.listingId))
        .limit(1);
      // The context card must reference a listing owned by one of the two participants
      if (
        !listing ||
        (listing.userId !== senderId && listing.userId !== dto.recipientId)
      )
        throw new BadRequestException('Invalid listing context');
    }

    // Race-safe find-or-create + recency bump in one statement
    const [a, b] = this.canonicalPair(senderId, dto.recipientId);
    const [conversation] = await this.db
      .insert(conversations)
      .values({ userAId: a, userBId: b, lastMessageAt: new Date() })
      .onConflictDoUpdate({
        target: [conversations.userAId, conversations.userBId],
        set: { lastMessageAt: new Date() },
      })
      .returning();

    let imageUrl: string | null = null;
    if (dto.imagePath) {
      const { data } = this.supabaseService.getPublicUrl(
        this.bucket,
        dto.imagePath,
      );
      imageUrl = data.publicUrl;
    }

    const [message] = await this.db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        senderId,
        body: dto.body ?? null,
        listingId: dto.listingId ?? null,
        imageUrl,
        imagePath: dto.imagePath ?? null,
      })
      .returning();

    const contexts = await this.batchLoadListingContexts(
      dto.listingId ? [dto.listingId] : [],
    );
    return {
      conversationId: conversation.id,
      message: {
        ...message,
        listing: dto.listingId ? (contexts.get(dto.listingId) ?? null) : null,
      },
    };
  }

  async getInbox(
    userId: string,
    query: QueryChatsDto,
  ): Promise<{ data: InboxItem[]; meta: PaginationMeta }> {
    const limit = query.limit ?? 20;
    const conditions: SQL[] = [
      or(eq(conversations.userAId, userId), eq(conversations.userBId, userId))!,
    ];

    if (query.cursor) {
      const decoded = this.decodeCursor(query.cursor);
      if (decoded) {
        conditions.push(
          or(
            lt(conversations.lastMessageAt, decoded.createdAt),
            and(
              eq(conversations.lastMessageAt, decoded.createdAt),
              lt(conversations.id, decoded.id),
            ),
          )!,
        );
      }
    }

    const rows = await this.db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    const nextCursor =
      hasMore && last ? this.encodeCursor(last.lastMessageAt, last.id) : null;

    const items = await this.buildInboxItems(userId, data);
    return { data: items, meta: { nextCursor, hasMore, limit } };
  }

  async getConversationWith(
    userId: string,
    otherUserId: string,
  ): Promise<ConversationWithUser> {
    if (otherUserId === userId)
      throw new BadRequestException('Cannot chat with yourself');

    const [otherUser] = await this.db
      .select({
        id: users.id,
        username: users.username,
        profilePhotoUrl: users.profilePhotoUrl,
      })
      .from(users)
      .where(and(eq(users.id, otherUserId), isNull(users.deletedAt)))
      .limit(1);
    if (!otherUser) throw new NotFoundException('User not found');

    const blocks = await this.db
      .select()
      .from(userBlocks)
      .where(
        or(
          and(
            eq(userBlocks.blockerId, userId),
            eq(userBlocks.blockedId, otherUserId),
          ),
          and(
            eq(userBlocks.blockerId, otherUserId),
            eq(userBlocks.blockedId, userId),
          ),
        ),
      );

    const [a, b] = this.canonicalPair(userId, otherUserId);
    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.userAId, a), eq(conversations.userBId, b)))
      .limit(1);

    const items = conversation
      ? await this.buildInboxItems(userId, [conversation])
      : [];

    return {
      conversation: items[0] ?? null,
      otherUser,
      blockedByMe: blocks.some((row) => row.blockerId === userId),
      canMessage: blocks.length === 0,
    };
  }

  async getMessages(
    userId: string,
    conversationId: string,
    query: QueryMessagesDto,
  ): Promise<{ data: MessageWithListing[]; meta: ChatMessagesMeta }> {
    await this.getConversationForUserOrThrow(conversationId, userId);
    if (query.cursor && query.after)
      throw new BadRequestException('Provide either cursor or after, not both');

    const limit = query.limit ?? 30;
    const afterMode = Boolean(query.after);
    const conditions: SQL[] = [eq(messages.conversationId, conversationId)];

    if (query.cursor) {
      const decoded = this.decodeCursor(query.cursor);
      if (decoded) {
        conditions.push(
          or(
            lt(messages.createdAt, decoded.createdAt),
            and(
              eq(messages.createdAt, decoded.createdAt),
              lt(messages.id, decoded.id),
            ),
          )!,
        );
      }
    } else if (query.after) {
      const decoded = this.decodeCursor(query.after);
      if (decoded) {
        conditions.push(
          or(
            gt(messages.createdAt, decoded.createdAt),
            and(
              eq(messages.createdAt, decoded.createdAt),
              gt(messages.id, decoded.id),
            ),
          )!,
        );
      }
    }

    const rows = await this.db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(
        ...(afterMode
          ? [asc(messages.createdAt), asc(messages.id)]
          : [desc(messages.createdAt), desc(messages.id)]),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    // Both modes: the last returned row is the continuation point
    const last = data[data.length - 1];
    const nextCursor =
      hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null;
    // Newest returned message: first in history (DESC), last in delta (ASC)
    const newest = afterMode ? data[data.length - 1] : data[0];
    const latestCursor = newest
      ? this.encodeCursor(newest.createdAt, newest.id)
      : null;

    const [readRow] = await this.db
      .select({ last: max(messages.readAt) })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderId, userId),
        ),
      );

    const listingIds = [
      ...new Set(
        data.map((m) => m.listingId).filter((id): id is string => id !== null),
      ),
    ];
    const contexts = await this.batchLoadListingContexts(listingIds);
    const withListing = data.map((m) => ({
      ...m,
      listing: m.listingId ? (contexts.get(m.listingId) ?? null) : null,
    }));

    return {
      data: withListing,
      meta: {
        nextCursor,
        hasMore,
        limit,
        latestCursor,
        peerLastReadAt: readRow?.last ?? null,
      },
    };
  }

  async markRead(
    userId: string,
    conversationId: string,
  ): Promise<{ marked: number }> {
    await this.getConversationForUserOrThrow(conversationId, userId);
    const marked = await this.db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderId, userId),
          isNull(messages.readAt),
        ),
      )
      .returning({ id: messages.id });
    return { marked: marked.length };
  }

  async getUnreadCount(userId: string): Promise<{ total: number }> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          or(
            eq(conversations.userAId, userId),
            eq(conversations.userBId, userId),
          ),
          ne(messages.senderId, userId),
          isNull(messages.readAt),
        ),
      );
    return { total: row?.total ?? 0 };
  }

  private canonicalPair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private async getConversationForUserOrThrow(
    conversationId: string,
    userId: string,
  ): Promise<ConversationRow> {
    const [conversation] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    // 404 for non-participants too: no conversation-id existence oracle
    if (
      !conversation ||
      (conversation.userAId !== userId && conversation.userBId !== userId)
    )
      throw new NotFoundException('Conversation not found');
    return conversation;
  }

  private async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
          and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  private async buildInboxItems(
    userId: string,
    rows: ConversationRow[],
  ): Promise<InboxItem[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((c) => c.id);
    const otherIds = rows.map((c) =>
      c.userAId === userId ? c.userBId : c.userAId,
    );

    const [lastMessages, unreadCounts, userSummaries] = await Promise.all([
      this.batchLoadLastMessages(ids),
      this.batchLoadUnreadCounts(ids, userId),
      this.batchLoadUserSummaries(otherIds),
    ]);

    return rows.map((c) => {
      const otherId = c.userAId === userId ? c.userBId : c.userAId;
      return {
        id: c.id,
        otherUser: userSummaries.get(otherId) ?? null,
        lastMessage: lastMessages.get(c.id) ?? null,
        unreadCount: unreadCounts.get(c.id) ?? 0,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
      };
    });
  }

  private async batchLoadLastMessages(
    conversationIds: string[],
  ): Promise<Map<string, MessageRow>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.db
      .selectDistinctOn([messages.conversationId])
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(
        messages.conversationId,
        desc(messages.createdAt),
        desc(messages.id),
      );
    return new Map(rows.map((m) => [m.conversationId, m]));
  }

  private async batchLoadUnreadCounts(
    conversationIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, conversationIds),
          ne(messages.senderId, userId),
          isNull(messages.readAt),
        ),
      )
      .groupBy(messages.conversationId);
    return new Map(rows.map((r) => [r.conversationId, r.count]));
  }

  private async batchLoadUserSummaries(
    userIds: string[],
  ): Promise<Map<string, ChatUserSummary>> {
    if (userIds.length === 0) return new Map();
    // No deletedAt filter: history with soft-deleted users stays renderable;
    // new sends to them are rejected in sendMessage anyway.
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        profilePhotoUrl: users.profilePhotoUrl,
      })
      .from(users)
      .where(inArray(users.id, userIds));
    return new Map(rows.map((u) => [u.id, u]));
  }

  private async batchLoadListingContexts(
    listingIds: string[],
  ): Promise<Map<string, ListingContext>> {
    if (listingIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        id: listings.id,
        title: listings.title,
        price: listings.price,
        currency: listings.currency,
        status: listings.status,
      })
      .from(listings)
      .where(inArray(listings.id, listingIds));

    const photos = await this.db
      .select()
      .from(listingPhotos)
      .where(inArray(listingPhotos.listingId, listingIds))
      .orderBy(listingPhotos.sort);
    const thumbnails = new Map<string, string>();
    for (const photo of photos) {
      if (!thumbnails.has(photo.listingId))
        thumbnails.set(photo.listingId, photo.url);
    }

    return new Map(
      rows.map((l) => [
        l.id,
        { ...l, thumbnailUrl: thumbnails.get(l.id) ?? null },
      ]),
    );
  }

  private encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf8'),
      ) as { createdAt?: unknown; id?: unknown } | null;
      if (
        typeof parsed?.createdAt !== 'string' ||
        typeof parsed?.id !== 'string'
      )
        return null;
      const createdAt = new Date(parsed.createdAt);
      if (Number.isNaN(createdAt.getTime())) return null;
      return { createdAt, id: parsed.id };
    } catch {
      return null;
    }
  }
}
