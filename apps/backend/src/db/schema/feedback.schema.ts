import {
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
 * Product feedback submitted from the public `/feedback` page.
 *
 * `userId` is null for an anonymous submission and SET NULL when the account
 * is purged: the feedback itself is platform history (the submitter's name,
 * phone and email are already on the row), so deleting the account must not
 * erase the queue. `imagePaths` holds storage paths under `feedback/`, not
 * public URLs — the admin API derives the URLs.
 */
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 200 }).notNull(),
    phone: varchar('phone', { length: 32 }).notNull(),
    email: varchar('email', { length: 254 }),
    description: text('description').notNull(),
    imagePaths: jsonb('image_paths').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('feedback_created_at_idx').on(t.createdAt),
    index('feedback_user_id_idx').on(t.userId),
  ],
);

export type FeedbackRow = typeof feedback.$inferSelect;
