import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Lifecycle of one outbox row.
 *
 * `processing` is a lease, not a state a row rests in: a dispatcher stamps
 * `lockedAt`/`lockedBy` when it claims the row and moves it off `processing`
 * before it finishes. A row stuck in `processing` past the lease timeout is
 * reclaimable — that is how a crashed dispatcher's work is recovered.
 */
export const outboxEventStatusEnum = pgEnum('outbox_event_status', [
  'pending',
  'processing',
  'published',
  'failed',
]);

/**
 * Transactional outbox for integration events.
 *
 * Postgres is both the durable event log and the queue: a domain write and
 * its event commit in the same transaction, and dispatchers claim rows with
 * `FOR UPDATE SKIP LOCKED` so many instances can drain the table without
 * coordinating. Redis is deliberately not involved — it is the throttler's
 * store, never the delivery ledger.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    /** Also the integration event's id — consumers dedupe on this. */
    id: uuid('id').defaultRandom().primaryKey(),
    // Dotted namespace, e.g. 'chat.message.sent'. Free text rather
    // than a pgEnum so a new event type is a code change, not a migration.
    eventType: varchar('event_type', { length: 80 }).notNull(),
    aggregateType: varchar('aggregate_type', { length: 40 }).notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    /**
     * Optional producer-side idempotency key. Postgres unique indexes ignore
     * NULLs, so events that don't set one never collide with each other.
     */
    dedupeKey: varchar('dedupe_key', { length: 200 }),
    payload: jsonb('payload').notNull(),
    status: outboxEventStatusEnum('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    /** Backoff gate: a pending row is invisible to claims until this passes. */
    availableAt: timestamp('available_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: varchar('locked_by', { length: 100 }),
    lastError: text('last_error'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // The claim query's index: ordered scan of what is due, by status.
    index('outbox_events_status_available_at_idx').on(t.status, t.availableAt),
    index('outbox_events_aggregate_idx').on(t.aggregateType, t.aggregateId),
    uniqueIndex('outbox_events_dedupe_key_idx').on(t.dedupeKey),
    // Retention sweep: rows in a terminal state are purged by `publishedAt`.
    index('outbox_events_published_at_idx')
      .on(t.publishedAt)
      .where(sql`status in ('published','failed')`),
  ],
);

export type OutboxEventRow = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
