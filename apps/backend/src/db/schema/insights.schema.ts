import { index, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { listings } from './listings.schema';
import { users } from './users.schema';

/** The buyer interactions the Insight page reports. */
export const LISTING_EVENT_TYPES = [
  'impression',
  'view',
  'chat',
  'call',
  'show_contact',
  'apply_job',
] as const;

export type ListingEventType = (typeof LISTING_EVENT_TYPES)[number];

export const listingEventTypeEnum = pgEnum(
  'listing_event_type',
  LISTING_EVENT_TYPES,
);

/**
 * One recorded interaction with a listing — the fact table behind `/insight`.
 *
 * `ownerId` is denormalized from the listing, exactly like
 * `job_applications.poster_id`: the owner's summary is the only hot read, the
 * listing's owner cannot change (there is no transfer path), and a join would
 * make every summary a two-table scan.
 *
 * `actorId` is null for anonymous visitors. It uses SET NULL rather than
 * CASCADE because `AccountPurgeService` hard-deletes accounts: a viewer leaving
 * must not subtract historical engagement from someone else's totals.
 *
 * `listingId` cascades — a hard-deleted listing takes its events with it. A
 * soft-deleted listing keeps them, so its historical engagement still counts.
 */
export const listingEvents = pgTable(
  'listing_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    eventType: listingEventTypeEnum('event_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // The summary groups one owner's events by type.
    index('listing_events_owner_type_idx').on(t.ownerId, t.eventType),
    // FK cascade + the future per-listing breakdown. Postgres does not
    // auto-index foreign keys.
    index('listing_events_listing_id_idx').on(t.listingId),
  ],
);

export type ListingEventRow = typeof listingEvents.$inferSelect;
export type NewListingEvent = typeof listingEvents.$inferInsert;
