import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.schema';
import { discountTypeEnum } from './listings.schema';

export const subscriptionDurationUnitEnum = pgEnum(
  'subscription_duration_unit',
  ['day', 'month', 'year'],
);

export const subscriptionPurchaseStatusEnum = pgEnum(
  'subscription_purchase_status',
  ['pending', 'paid', 'failed', 'cancelled', 'refunded'],
);

export const subscriptionPurchaseKindEnum = pgEnum(
  'subscription_purchase_kind',
  ['initial', 'upgrade', 'manual_comp'],
);

export const subscriptionCategories = pgTable('subscription_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  slug: varchar('slug', { length: 120 }).unique().notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => subscriptionCategories.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description'),
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
    uniqueIndex('subscription_plans_category_slug_uq').on(t.categoryId, t.slug),
    index('subscription_plans_category_id_idx').on(t.categoryId),
  ],
);

export const subscriptionPackages = pgTable(
  'subscription_packages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    photos: integer('photos').default(0).notNull(),
    ads: integer('ads').default(0).notNull(),
    renews: integer('renews').default(0).notNull(),
    autoRenews: integer('auto_renews').default(0).notNull(),
    videos: integer('videos').default(0).notNull(),
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
  (t) => [index('subscription_packages_plan_id_idx').on(t.planId)],
);

export const subscriptionTerms = pgTable(
  'subscription_terms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    packageId: uuid('package_id')
      .notNull()
      .references(() => subscriptionPackages.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    durationValue: integer('duration_value').default(1).notNull(),
    durationUnit: subscriptionDurationUnitEnum('duration_unit')
      .default('month')
      .notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).default('0').notNull(),
    discount: numeric('discount', { precision: 10, scale: 2 })
      .default('0')
      .notNull(),
    discountType: discountTypeEnum('discount_type').default('amount').notNull(),
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
  (t) => [index('subscription_terms_package_id_idx').on(t.packageId)],
);

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    termId: uuid('term_id').references(() => subscriptionTerms.id, {
      onDelete: 'set null',
    }),
    priceUsd: numeric('price_usd', { precision: 10, scale: 2 })
      .default('0')
      .notNull(),
    paymentMethod: varchar('payment_method', { length: 40 }),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    supersededReason: varchar('superseded_reason', { length: 40 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('user_subscriptions_user_id_idx').on(t.userId),
    index('user_subscriptions_expires_at_idx').on(t.expiresAt),
    index('user_subscriptions_active_idx')
      .on(t.userId, t.expiresAt)
      .where(sql`${t.supersededAt} is null`),
  ],
);

export const subscriptionPurchases = pgTable(
  'subscription_purchases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    termId: uuid('term_id').references(() => subscriptionTerms.id, {
      onDelete: 'set null',
    }),
    paymentTransactionId: uuid('payment_transaction_id').unique(),
    kind: subscriptionPurchaseKindEnum('kind').default('initial').notNull(),
    status: subscriptionPurchaseStatusEnum('status')
      .default('pending')
      .notNull(),
    amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
    creditUsd: numeric('credit_usd', { precision: 10, scale: 2 })
      .default('0')
      .notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    offerSnapshot: jsonb('offer_snapshot').notNull(),
    replacesSubscriptionId: uuid('replaces_subscription_id').references(
      () => userSubscriptions.id,
      { onDelete: 'set null' },
    ),
    subscriptionId: uuid('subscription_id').references(
      () => userSubscriptions.id,
      { onDelete: 'set null' },
    ),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).unique(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    refundRequestedAt: timestamp('refund_requested_at', {
      withTimezone: true,
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
    index('subscription_purchases_user_idx').on(t.userId, t.createdAt),
    index('subscription_purchases_status_idx').on(t.status, t.createdAt),
  ],
);

export type SubscriptionCategoryRow =
  typeof subscriptionCategories.$inferSelect;
export type SubscriptionPlanRow = typeof subscriptionPlans.$inferSelect;
export type SubscriptionPackageRow = typeof subscriptionPackages.$inferSelect;
export type SubscriptionTermRow = typeof subscriptionTerms.$inferSelect;
export type UserSubscriptionRow = typeof userSubscriptions.$inferSelect;
export type SubscriptionPurchaseRow = typeof subscriptionPurchases.$inferSelect;
