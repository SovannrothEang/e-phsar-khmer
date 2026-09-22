import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * In-app notification record — the durable channel every notification gets,
 * regardless of which other channels (email, push, ...) also fire for it.
 * See `src/notifications/README.md`-equivalent doc comment in
 * `notification-channel.interface.ts` for the channel abstraction this
 * table backs.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Dotted namespace, e.g. 'payment.succeeded' — mirrors outbox_events'
    // own eventType convention so the two vocabularies stay one vocabulary.
    type: varchar('type', { length: 80 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    // Structured detail a client can act on (e.g. paymentTransactionId) —
    // free-form JSON so a new notification type never needs a migration.
    data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // The feed query: this user's notifications, newest first.
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    // The unread-badge query — partial so it stays small as read rows pile up.
    index('notifications_user_unread_idx')
      .on(t.userId)
      .where(sql`is_read = false`),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
