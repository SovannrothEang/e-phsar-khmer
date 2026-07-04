import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { categories, subcategories } from './categories.schema';
import { communes, districts, provinces, users } from './users.schema';

export const listingStatusEnum = pgEnum('listing_status', [
  'draft',
  'active',
  'expired',
  'deleted',
]);
export const discountTypeEnum = pgEnum('discount_type', ['percent', 'amount']);
export const listingConditionEnum = pgEnum('listing_condition', [
  'new',
  'used',
]);

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    subcategoryId: uuid('subcategory_id')
      .notNull()
      .references(() => subcategories.id),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    price: numeric('price', { precision: 14, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    discountValue: numeric('discount_value', { precision: 14, scale: 2 }),
    discountType: discountTypeEnum('discount_type'),
    condition: listingConditionEnum('condition'),
    attributes: jsonb('attributes')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    location: varchar('location', { length: 150 }),
    address: text('address'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    provinceId: uuid('province_id').references(() => provinces.id),
    districtId: uuid('district_id').references(() => districts.id),
    communeId: uuid('commune_id').references(() => communes.id),
    deliveryFree: boolean('delivery_free').default(false).notNull(),
    contactName: varchar('contact_name', { length: 150 }),
    contactPhones: jsonb('contact_phones')
      .$type<string[]>()
      .default([])
      .notNull(),
    contactEmail: varchar('contact_email', { length: 255 }),
    status: listingStatusEnum('status').default('draft').notNull(),
    viewsCount: integer('views_count').default(0).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('listings_status_idx').on(t.status),
    index('listings_category_id_idx').on(t.categoryId),
    index('listings_subcategory_id_idx').on(t.subcategoryId),
    index('listings_user_id_idx').on(t.userId),
    index('listings_created_at_idx').on(t.createdAt),
    // Matches the (createdAt, id) cursor tie-break used by the public feed
    index('listings_status_created_at_idx').on(t.status, t.createdAt, t.id),
    index('listings_province_id_idx').on(t.provinceId),
    index('listings_district_id_idx').on(t.districtId),
    index('listings_commune_id_idx').on(t.communeId),
    check('listings_price_nonnegative', sql`price >= 0`),
    check('listings_discount_value_nonnegative', sql`discount_value >= 0`),
    check(
      'listings_discount_pair',
      sql`(discount_value is null) = (discount_type is null)`,
    ),
    check(
      'listings_discount_percent_max',
      sql`discount_type <> 'percent' or discount_value <= 100`,
    ),
  ],
);

export type ListingRow = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

export const listingPhotos = pgTable(
  'listing_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    path: text('path').notNull(),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('listing_photos_listing_id_idx').on(t.listingId)],
);

export type ListingPhotoRow = typeof listingPhotos.$inferSelect;
export type NewListingPhoto = typeof listingPhotos.$inferInsert;
