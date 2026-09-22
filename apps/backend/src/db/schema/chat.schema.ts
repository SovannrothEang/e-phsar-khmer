import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
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

export interface E2eHeader {
  v: 1;
  dh: string; // base64 — sender's current ratchet public key
  pn: number; // previous sending chain length
  n: number; // message number in the current sending chain
  // Present only on the first message of a new session (X3DH initial message):
  identityKey?: string;
  ephemeralKey?: string;
  oneTimePrekeyId?: number;
  signedPrekeyId?: number;
}

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
    // Client-generated dedup key (e.g. a UUID minted before the send call) so
    // a retried send — WS reconnect racing an ack, a double-tap — replays the
    // original message instead of creating a duplicate. Optional: REST already
    // gets this from IdempotencyMiddleware; this is the WS-path equivalent,
    // and works for REST too if a caller chooses to send it. Scoped to the
    // sender (not global) since IDs are client-minted, not server-issued.
    clientMessageId: text('client_message_id'),
    // Optional listing context card; the card survives listing removal via SET NULL
    listingId: uuid('listing_id').references(() => listings.id, {
      onDelete: 'set null',
    }),
    imageUrl: text('image_url'),
    imagePath: text('image_path'),
    readAt: timestamp('read_at', { withTimezone: true }),
    isE2e: boolean('is_e2e').default(false).notNull(),
    e2eHeader: jsonb('e2e_header').$type<E2eHeader | null>(),
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
    // Partial: NULLs (the common case — no idempotency key supplied) never
    // collide, so this only ever rejects a genuine retry of the same
    // (sender, clientMessageId) pair.
    uniqueIndex('messages_sender_client_id_uq')
      .on(t.senderId, t.clientMessageId)
      .where(sql`client_message_id is not null`),
    check(
      'messages_content_present',
      sql`body is not null or image_path is not null`,
    ),
    check(
      'messages_image_pair',
      sql`(image_url is null) = (image_path is null)`,
    ),
    check('messages_body_length_max', sql`char_length(body) <= 24000`),
  ],
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export const userE2eIdentities = chatSchema.table('user_e2e_identities', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  identityKey: text('identity_key').notNull(), // base64 X25519 public key (DH)
  // base64 Ed25519 public key — signs signedPrekeyPublic. Separate from
  // identityKey because X3DH needs the identity key to both DH (X25519) and
  // sign (Ed25519); noble/curves doesn't expose the Edwards<->Montgomery
  // conversion Signal's own XEdDSA uses to make one key do both, and
  // hand-rolling that curve-point conversion isn't worth the risk.
  identitySigningKey: text('identity_signing_key').notNull(),
  registrationId: integer('registration_id').notNull(),
  signedPrekeyId: integer('signed_prekey_id').notNull(),
  signedPrekeyPublic: text('signed_prekey_public').notNull(), // base64
  signedPrekeySignature: text('signed_prekey_signature').notNull(), // base64
  signedPrekeyCreatedAt: timestamp('signed_prekey_created_at', {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserE2eIdentityRow = typeof userE2eIdentities.$inferSelect;
export type NewUserE2eIdentity = typeof userE2eIdentities.$inferInsert;

export const userE2eOneTimePrekeys = chatSchema.table(
  'user_e2e_one_time_prekeys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prekeyId: integer('prekey_id').notNull(),
    publicKey: text('public_key').notNull(), // base64
    usedAt: timestamp('used_at', { withTimezone: true }), // null = available
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('user_e2e_otp_user_prekey_uq').on(t.userId, t.prekeyId),
    // Serves the claim query in E2eKeysService.getBundle: only unused rows,
    // scoped to one user — same partial-index shape as
    // messages_conversation_unread_idx above and users_username_active_uq
    // (users.schema.ts).
    index('user_e2e_otp_available_idx')
      .on(t.userId)
      .where(sql`used_at is null`),
  ],
);

export type UserE2eOneTimePrekeyRow = typeof userE2eOneTimePrekeys.$inferSelect;
export type NewUserE2eOneTimePrekey = typeof userE2eOneTimePrekeys.$inferInsert;
