import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
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
import { isBlockedEitherWay } from './blocks.util';
import { isUniqueViolation } from './pg-errors.util';
import { ChatPubSubService } from './chat-pubsub.service';
import type { ChatPushEvent } from './chat-pubsub.service';
import { ChatMetricsService } from './chat-metrics.service';
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

  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly pubsub: ChatPubSubService,
    private readonly metrics: ChatMetricsService,
  ) {}

  /**
   * Fire-and-forget over Redis (see ChatPubSubService) — a dropped push just
   * means the recipient sees the change on their next poll, so a publish
   * failure must never fail the request that triggered it.
   */
  private async publishChatEvents(events: ChatPushEvent[]): Promise<void> {
    await Promise.all(
      events.map((event) =>
        this.pubsub.publish(event).catch((err: unknown) => {
          this.logger.warn(`Chat push failed: ${String(err)}`);
        }),
      ),
    );
  }

  private get bucket(): string {
    return (
      this.configService.get<string>('supabase.storageBucket') ?? 'listings'
    );
  }

  /**
   * Above this, a send gets logged with a WARN so it shows up without
   * anyone needing to be watching — this exact threshold is what a burst of
   * concurrent sends looked like queueing for a DB pool connection (see
   * ChatMetricsService / GET /admin/chat-metrics for the running picture).
   */
  private static readonly SLOW_SEND_WARN_MS = 500;

  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<{ conversationId: string; message: MessageWithListing }> {
    const start = process.hrtime.bigint();
    this.metrics.beginSend();
    try {
      return await this.sendMessageInternal(senderId, dto);
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this.metrics.endSend(durationMs);
      if (durationMs > ChatService.SLOW_SEND_WARN_MS) {
        this.logger.warn(
          `Slow chat send: ${durationMs.toFixed(0)}ms (senderId=${senderId})`,
        );
      }
    }
  }

  private async sendMessageInternal(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<{ conversationId: string; message: MessageWithListing }> {
    // Idempotent replay: a retried send (WS reconnect racing an ack, a
    // double-tap) with the same clientMessageId returns the ORIGINAL result
    // instead of re-validating and re-inserting — same intent as the REST
    // path's IdempotencyMiddleware, for the transport (WS) that has no
    // Idempotency-Key header to hang that off of. Skips all validation and
    // writes entirely on a genuine replay.
    if (dto.clientMessageId) {
      const replay = await this.findByClientMessageId(
        senderId,
        dto.clientMessageId,
      );
      if (replay) return replay;
    }

    if (dto.recipientId === senderId)
      throw new BadRequestException('Cannot message yourself');
    if (!dto.body && !dto.imagePath)
      throw new BadRequestException('Message must contain text or an image');
    if (dto.e2eHeader && dto.imagePath)
      throw new BadRequestException('E2E messages cannot include an image yet');
    if (dto.imagePath) this.assertOwnedChatImagePath(dto.imagePath, senderId);

    // These three checks are independent reads (none depends on another's
    // result), so they run concurrently instead of as sequential round trips
    // to the DB — each round trip to a remote Postgres is the dominant cost
    // on this path, not query execution time. Priority of which error wins
    // when multiple checks fail stays the same as the old sequential order:
    // recipient existence, then block, then listing ownership.
    const [recipient, blocked, listing] = await Promise.all([
      this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, dto.recipientId), isNull(users.deletedAt)))
        .limit(1)
        .then((rows) => rows[0]),
      isBlockedEitherWay(this.db, senderId, dto.recipientId),
      dto.listingId
        ? this.db
            .select({ id: listings.id, userId: listings.userId })
            .from(listings)
            .where(eq(listings.id, dto.listingId))
            .limit(1)
            .then((rows) => rows[0])
        : Promise.resolve(undefined),
    ]);
    if (!recipient) throw new NotFoundException('Recipient not found');
    if (blocked) throw new ForbiddenException('Messaging unavailable');
    if (dto.listingId) {
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
        // A real message is a real interaction — revive the thread for BOTH
        // sides even if one (or both) had deleted it, not just the sender.
        set: {
          lastMessageAt: sql`now()`,
          deletedByUserAAt: null,
          deletedByUserBAt: null,
        },
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

    let message: MessageRow;
    try {
      [message] = await this.db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderId,
          body: dto.body ?? null,
          clientMessageId: dto.clientMessageId ?? null,
          listingId: dto.listingId ?? null,
          imageUrl,
          imagePath: dto.imagePath ?? null,
          groupId: dto.groupId ?? null,
          isE2e: Boolean(dto.e2eHeader),
          e2eHeader: dto.e2eHeader ?? null,
        })
        .returning();
    } catch (err) {
      // Two near-simultaneous retries with the same clientMessageId (a truly
      // concurrent double-send, not just a slow one) can both pass the replay
      // check above before either has inserted — the loser hits the unique
      // index instead of finding a row to replay. Self-heal: look up what the
      // winner just inserted and hand back that result instead of a 500.
      if (
        dto.clientMessageId &&
        isUniqueViolation(err, 'messages_sender_client_id_uq')
      ) {
        const replay = await this.findByClientMessageId(
          senderId,
          dto.clientMessageId,
        );
        if (replay) return replay;
      }
      throw err;
    }

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
    const withListing = {
      ...message,
      listing: dto.listingId ? (contexts.get(dto.listingId) ?? null) : null,
    };

    // Push over the realtime channel regardless of whether this call came
    // from REST or the WS gateway — ChatGateway only ever writes to LOCAL
    // sockets, so this is the one path that reaches a recipient connected to
    // a different backend instance too. `message` carries the row; the inbox
    // / unread-count events are plain "something changed" signals — the
    // client re-runs its existing query functions rather than this layer
    // serializing those shapes a second time.
    await this.publishChatEvents([
      { targetUserId: dto.recipientId, type: 'message', payload: withListing },
      { targetUserId: dto.recipientId, type: 'inbox_update' },
      { targetUserId: senderId, type: 'inbox_update' },
      { targetUserId: dto.recipientId, type: 'unread_count' },
    ]);

    return { conversationId: conversation.id, message: withListing };
  }

  async getInbox(
    userId: string,
    query: QueryChatsDto,
  ): Promise<{ data: InboxItem[]; meta: PaginationMeta }> {
    const limit = query.limit ?? 20;
    const conditions: SQL[] = [
      // Participant AND not hidden by ME specifically — the other side's
      // delete flag is irrelevant to what I see in my own inbox.
      or(
        and(
          eq(conversations.userAId, userId),
          isNull(conversations.deletedByUserAAt),
        ),
        and(
          eq(conversations.userBId, userId),
          isNull(conversations.deletedByUserBAt),
        ),
      )!,
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

  /**
   * Find-or-create the conversation with `otherUserId`, WITHOUT sending a
   * message. Backs "Message seller" → redirect-to-chat: the thread (and its
   * listing context, attached client-side until the first real send) must
   * exist and show up in both inboxes the moment the buyer opens the thread,
   * not only once they type something.
   *
   * Same rejects as sendMessage (self, missing/soft-deleted recipient,
   * block in either direction) MINUS the body/image requirement — there is
   * no content yet. Unlike the upsert in sendMessageInternal, this does NOT
   * bump lastMessageAt on an existing row (no message actually happened) and
   * only revives the conversation for the CALLER's own delete flag — the
   * other participant's inbox is unaffected by someone merely opening the
   * thread on their side.
   */
  async startConversation(
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

    const blocked = await isBlockedEitherWay(this.db, userId, otherUserId);
    if (blocked) throw new ForbiddenException('Messaging unavailable');

    const [a, b] = this.canonicalPair(userId, otherUserId);
    const meIsA = userId === a;
    const [conversation] = await this.db
      .insert(conversations)
      .values({ userAId: a, userBId: b })
      .onConflictDoUpdate({
        target: [conversations.userAId, conversations.userBId],
        set: meIsA ? { deletedByUserAAt: null } : { deletedByUserBAt: null },
      })
      .returning();

    const items = await this.buildInboxItems(userId, [conversation]);

    await this.publishChatEvents([
      { targetUserId: userId, type: 'inbox_update' },
    ]);

    return {
      conversation: items[0] ?? null,
      otherUser,
      blockedByMe: false,
      canMessage: true,
    };
  }

  /**
   * Per-participant hide — see the `deletedByUser{A,B}At` comment on the
   * schema. Never deletes rows: the other participant's copy of the thread,
   * and every message in it, is untouched.
   */
  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ deleted: true }> {
    const conversation = await this.getConversationForUserOrThrow(
      conversationId,
      userId,
    );
    const meIsA = conversation.userAId === userId;
    await this.db
      .update(conversations)
      .set(
        meIsA
          ? { deletedByUserAAt: sql`now()` }
          : { deletedByUserBAt: sql`now()` },
      )
      .where(eq(conversations.id, conversationId));

    await this.publishChatEvents([
      { targetUserId: userId, type: 'inbox_update' },
    ]);

    return { deleted: true };
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

    // Only the reader's own badge/inbox state changed by reading — the
    // sender's side is unaffected until they next poll or send.
    if (marked.length > 0) {
      await this.publishChatEvents([
        { targetUserId: userId, type: 'unread_count' },
        { targetUserId: userId, type: 'inbox_update' },
      ]);
    }

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

  /** Looks up a previously-sent message by its client-generated dedup key. */
  private async findByClientMessageId(
    senderId: string,
    clientMessageId: string,
  ): Promise<{ conversationId: string; message: MessageWithListing } | null> {
    const [existing] = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.senderId, senderId),
          eq(messages.clientMessageId, clientMessageId),
        ),
      )
      .limit(1);
    if (!existing) return null;

    const contexts = await this.batchLoadListingContexts(
      existing.listingId ? [existing.listingId] : [],
    );
    return {
      conversationId: existing.conversationId,
      message: {
        ...existing,
        listing: existing.listingId
          ? (contexts.get(existing.listingId) ?? null)
          : null,
      },
    };
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
        deletedByUserAAt: conversations.deletedByUserAAt,
        deletedByUserBAt: conversations.deletedByUserBAt,
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
