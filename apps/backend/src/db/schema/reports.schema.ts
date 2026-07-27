import {
  boolean,
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
import { users } from './users.schema';
import { listings } from './listings.schema';

export const reportTargetTypeEnum = pgEnum('report_target_type', [
  'user',
  'listing',
]);

export const reportStatusEnum = pgEnum('report_status', [
  'pending',
  'approved',
  'rejected',
]);

/** Admin-managed picklist of reasons, discriminated by what's being reported. */
export const reportReasons = pgTable(
  'report_reasons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    targetType: reportTargetTypeEnum('target_type').notNull(),
    reason: varchar('reason', { length: 160 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('report_reasons_type_reason_uq').on(t.targetType, t.reason),
    index('report_reasons_target_type_idx').on(t.targetType),
  ],
);

export const userReports = pgTable(
  'user_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reasonId: uuid('reason_id').references(() => reportReasons.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    imagePaths: jsonb('image_paths').$type<string[]>().default([]).notNull(),
    status: reportStatusEnum('status').default('pending').notNull(),
    reviewedById: uuid('reviewed_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('user_reports_status_idx').on(t.status),
    index('user_reports_target_user_id_idx').on(t.targetUserId),
  ],
);

export const listingReports = pgTable(
  'listing_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    reasonId: uuid('reason_id').references(() => reportReasons.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    status: reportStatusEnum('status').default('pending').notNull(),
    reviewedById: uuid('reviewed_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('listing_reports_status_idx').on(t.status),
    index('listing_reports_listing_id_idx').on(t.listingId),
  ],
);

export type ReportReasonRow = typeof reportReasons.$inferSelect;
export type UserReportRow = typeof userReports.$inferSelect;
export type ListingReportRow = typeof listingReports.$inferSelect;
