import { sql } from 'drizzle-orm';
import {
  check,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { listings } from './listings.schema';
import { chatSchema } from './chat.pg-schema';

export const conversations = chatSchema.table(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Canonical unordered pair: user_a_id < user_b_id (service sorts before insert)
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: uuid('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Denormalized inbox ordering key; bumped on every send.
    // precision 3 (ms): cursors roundtrip through JS Dates, which have no
    // microseconds — full precision would make gt/lt boundary checks drift.
    lastMessageAt: timestamp('last_message_at', {
      withTimezone: true,
      precision: 3,
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('conversations_pair_uq').on(t.userAId, t.userBId),
    index('conversations_user_a_recency_idx').on(t.userAId, t.lastMessageAt),
    index('conversations_user_b_recency_idx').on(t.userBId, t.lastMessageAt),
    check('conversations_pair_ordered', sql`user_a_id < user_b_id`),
  ],
);

export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export const messages = chatSchema.table(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body'),
    // Optional listing context card; the card survives listing removal via SET NULL
    listingId: uuid('listing_id').references(() => listings.id, {
      onDelete: 'set null',
    }),
    imageUrl: text('image_url'),
    imagePath: text('image_path'),
    readAt: timestamp('read_at', { withTimezone: true }),
    // precision 3 (ms): must compare exactly against JS-Date-derived cursors
    // (see conversations.lastMessageAt)
    createdAt: timestamp('created_at', { withTimezone: true, precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // Serves both the history cursor (DESC) and the after-delta poll (ASC)
    index('messages_conversation_created_idx').on(
      t.conversationId,
      t.createdAt,
      t.id,
    ),
    // Unread counting + mark-read touch only unread rows
    index('messages_conversation_unread_idx')
      .on(t.conversationId, t.senderId)
      .where(sql`read_at is null`),
    index('messages_listing_id_idx').on(t.listingId),
    check(
      'messages_content_present',
      sql`body is not null or image_path is not null`,
    ),
    check(
      'messages_image_pair',
      sql`(image_url is null) = (image_path is null)`,
    ),
    check('messages_body_length_max', sql`char_length(body) <= 4000`),
  ],
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
