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

/** A conversation row plus the read-receipt watermark, fetched together. */
interface ConversationPollContext extends ConversationRow {
  /** max(readAt) of MY messages in this conversation. */
  peerLastReadAt: Date | null;
}

@Injectable()
export class ChatService {
  /**
   * The single object-name segment `FilesService.createSignedUploadUrl`
   * produces: `${randomUUID()}-${safeName(filename)}`, where `safeName`
   * collapses everything outside this class to `_`. Deliberately excludes `/`,
   * `\` and `%`, so no traversal — literal, encoded, or mixed — can survive it.
   */
  private static readonly CHAT_OBJECT_NAME_RE = /^[A-Za-z0-9._-]{1,200}$/;

  /** Cursor ids are compared against `uuid` columns; anything else is a 500. */
  private static readonly UUID_RE =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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
    if (dto.imagePath) this.assertOwnedChatImagePath(dto.imagePath, senderId);

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

    // Race-safe find-or-create + recency bump in one statement.
    // The bump uses the DB clock (`now()` / the column default), never
    // `new Date()`: lastMessageAt is the inbox ordering key and is compared
    // against messages.createdAt, so both must come from the same clock. An
    // app-server clock that runs ahead would park a thread at the top of every
    // participant's inbox until real time caught up.
    const [a, b] = this.canonicalPair(senderId, dto.recipientId);
    const [conversation] = await this.db
      .insert(conversations)
      .values({ userAId: a, userBId: b })
      .onConflictDoUpdate({
        target: [conversations.userAId, conversations.userBId],
        set: { lastMessageAt: sql`now()` },
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

    // Advance the thread watermark to the message's OWN createdAt. The upsert
    // above bumps lastMessageAt *before* the message row exists, so two
    // concurrent sends can commit their messages in the opposite order to
    // their bumps and leave lastMessageAt behind the newest message — which
    // would sort the thread wrongly in both participants' inboxes.
    // The `lt` predicate makes this a monotonic max: an out-of-order writer
    // can only ever move the watermark forward.
    await this.db
      .update(conversations)
      .set({ lastMessageAt: message.createdAt })
      .where(
        and(
          eq(conversations.id, conversation.id),
          lt(conversations.lastMessageAt, message.createdAt),
        ),
      );

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
    // Round trip #1 — participant auth AND the read-receipt watermark.
    const conversation = await this.getPollContextOrThrow(
      conversationId,
      userId,
    );
    if (query.cursor && query.after)
      throw new BadRequestException('Provide either cursor or after, not both');

    const limit = query.limit ?? 30;
    const afterMode = Boolean(query.after);
    const peerLastReadAt = conversation.peerLastReadAt;
    const decodedAfter = query.after ? this.decodeCursor(query.after) : null;

    // NOTE: there is deliberately no `lastMessageAt <= cursor` fast path here.
    // The watermark carries a timestamp but no id, so it cannot disambiguate
    // two messages sharing a millisecond: with m1=(T,A) and m2=(T,B), B>A, a
    // client holding cursor (T,A) sees lastMessageAt=T <= T and would be told
    // "nothing new" on that poll and on every poll after it — m2 is lost until
    // an unrelated later message moves the watermark past T. No grace window
    // fixes that (the state is stable, not settling), and tightening `<=` to
    // `<` disables the optimization outright, since on a quiet thread the
    // watermark equals the cursor timestamp by definition. Always scan.
    //
    // `conversation` is still fetched in one round trip with peerLastReadAt
    // (see getPollContextOrThrow) — that fusion is independent of the scan.

    // Scoping the scan to this conversation is what makes cursor tampering
    // inert: the cursor only ever moves a boundary WITHIN the conversation the
    // caller was just authorised for, so a forged cursor can reorder or skip
    // the caller's own messages but can never reach another thread's rows.
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
    } else if (decodedAfter) {
      conditions.push(
        or(
          gt(messages.createdAt, decodedAfter.createdAt),
          and(
            eq(messages.createdAt, decodedAfter.createdAt),
            gt(messages.id, decodedAfter.id),
          ),
        )!,
      );
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
    // Newest returned message: first in history (DESC), last in delta (ASC).
    // An empty delta page keeps the client's watermark instead of nulling it.
    const newest = afterMode ? data[data.length - 1] : data[0];
    const latestCursor = newest
      ? this.encodeCursor(newest.createdAt, newest.id)
      : afterMode && decodedAfter
        ? query.after!
        : null;

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
        peerLastReadAt,
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

  /**
   * An attached image must be an object the SENDER uploaded, and nothing else.
   *
   * Structural, not substring-based. A `startsWith('chat/{id}/')` + reject-`..`
   * pair is a denylist, and denylists on storage keys leak: `%2e%2e`,
   * backslashes and fullwidth dots all slip past a literal `..` scan, and any
   * of them may be normalised downstream by the storage layer. So instead:
   * split on `/`, demand exactly three segments, demand segment 2 EQUALS the
   * sender's id (an equality check — a prefix check could match a longer id,
   * even though UUIDs happen to be fixed-length), and constrain the object name
   * to the character class our own signer emits. `/`, `\` and `%` are outside
   * that class, so there is no encoding left to smuggle a separator through.
   */
  private assertOwnedChatImagePath(imagePath: string, senderId: string): void {
    const segments = imagePath.split('/');
    if (
      segments.length !== 3 ||
      segments[0] !== 'chat' ||
      segments[1] !== senderId ||
      segments[2] === '.' ||
      segments[2] === '..' ||
      !ChatService.CHAT_OBJECT_NAME_RE.test(segments[2])
    )
      throw new BadRequestException('Invalid image path');
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
    return this.ensureParticipant(conversation, userId);
  }

  /**
   * Participant auth check + the `peerLastReadAt` read-receipt watermark in a
   * SINGLE round trip. Both are needed on every message poll — including the
   * empty deltas that skip the message range scan — so they travel together.
   */
  private async getPollContextOrThrow(
    conversationId: string,
    userId: string,
  ): Promise<ConversationPollContext> {
    const [row] = await this.db
      .select({
        id: conversations.id,
        userAId: conversations.userAId,
        userBId: conversations.userBId,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        // Aggregate over the join rather than a scalar subquery in the select
        // list: drizzle rewrites top-level columns inside a `sql` select field
        // to BARE identifiers on single-table selects, which would silently
        // resolve the correlation against `messages` instead of
        // `conversations`. The join keeps every reference qualified.
        peerLastReadAt: max(messages.readAt),
      })
      .from(conversations)
      // Scans exactly what the old standalone peerLastReadAt query scanned:
      // my messages in this conversation, via messages_conversation_created_idx.
      .leftJoin(
        messages,
        and(
          eq(messages.conversationId, conversations.id),
          eq(messages.senderId, userId),
        ),
      )
      .where(eq(conversations.id, conversationId))
      // Grouping by the PK is enough — the other conversations columns are
      // functionally dependent on it.
      .groupBy(conversations.id)
      .limit(1);

    return this.ensureParticipant(row, userId);
  }

  private ensureParticipant<T extends { userAId: string; userBId: string }>(
    conversation: T | undefined,
    userId: string,
  ): T {
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
      // The id is compared against a `uuid` column. Postgres rejects a
      // non-UUID literal with 22P02, which surfaces as a 500 — so a crafted
      // cursor would be a one-request way to fault any endpoint that paginates.
      // Treat it like any other malformed cursor: ignore it.
      if (!ChatService.UUID_RE.test(parsed.id)) return null;
      const createdAt = new Date(parsed.createdAt);
      if (Number.isNaN(createdAt.getTime())) return null;
      return { createdAt, id: parsed.id };
    } catch {
      return null;
    }
  }
}
