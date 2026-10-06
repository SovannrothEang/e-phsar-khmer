import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listings } from './listings.schema';
import { users } from './users.schema';

/**
 * One like edge: `userId` liked `listingId`.
 *
 * Mirrors `user_follows` exactly — a unique pair index in the canonical
 * direction and a plain index on the listing side (the unique index cannot
 * serve "how many liked this listing", which is what the count and the
 * detail page need). Both FKs cascade: `AccountPurgeService` hard-deletes
 * `users` rows and relies on every FK into `users` taking its rows along, and
 * a listing being hard-deleted must not strand likes pointing at it. There is
 * deliberately no self-check — unlike following, liking your own listing is
 * allowed, because the heart renders on every card including your own.
 */
export const listingLikes = pgTable(
  'listing_likes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('listing_likes_pair_uq').on(t.userId, t.listingId),
    // Reverse-direction lookups: "who liked this listing"
    index('listing_likes_listing_id_idx').on(t.listingId),
  ],
);

/** One save edge. Same shape and rules as `listing_likes`. */
export const listingSaves = pgTable(
  'listing_saves',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('listing_saves_pair_uq').on(t.userId, t.listingId),
    // Reverse-direction lookups: "who saved this listing"
    index('listing_saves_listing_id_idx').on(t.listingId),
  ],
);

export type ListingLikeRow = typeof listingLikes.$inferSelect;
export type NewListingLike = typeof listingLikes.$inferInsert;
export type ListingSaveRow = typeof listingSaves.$inferSelect;
export type NewListingSave = typeof listingSaves.$inferInsert;
