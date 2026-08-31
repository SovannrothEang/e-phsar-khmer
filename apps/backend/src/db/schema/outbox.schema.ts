import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'processing',
  'published',
  'dead',
]);

/**
 * Transactional outbox. Rows are written inside the caller's business
 * transaction, then drained asynchronously by OutboxDispatcher.
 */
export const outboxMessages = pgTable(
  'outbox_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    topic: varchar('topic', { length: 80 }).notNull(),
    // Partition / ordering key — typically the userId the message belongs to.
    aggregateId: uuid('aggregate_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum('status').default('pending').notNull(),
    // Higher runs sooner (see the claim ORDER BY).
    priority: smallint('priority').default(0).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Optional idempotent-enqueue key; unique, so a repeated enqueue is a no-op.
    dedupeKey: varchar('dedupe_key', { length: 160 }),
    lockedBy: varchar('locked_by', { length: 64 }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    // Serves the claim query's predicate (status = 'pending' AND
    // next_attempt_at <= now()) and its leading ORDER BY key.
    index('outbox_messages_claim_idx')
      .on(t.priority.desc(), t.nextAttemptAt)
      .where(sql`status = 'pending'`),
    uniqueIndex('outbox_messages_dedupe_key_uq').on(t.dedupeKey),
    // Retention sweep of already-delivered rows.
    index('outbox_messages_published_idx')
      .on(t.publishedAt)
      .where(sql`status = 'published'`),
  ],
);

export type OutboxMessageRow = typeof outboxMessages.$inferSelect;
export type NewOutboxMessage = typeof outboxMessages.$inferInsert;
