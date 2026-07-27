import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { categories } from './categories.schema';

/**
 * Generic lookup table for all listing-form "attribute" option sets
 * (colors, RAMs, CPUs, body types, engine types, job types, …). The `type`
 * column discriminates the set. `subcategoryIds` is denormalized JSONB (mirrors
 * the admin UI shape) rather than a link table, since these are admin-managed
 * lookups not consumed at runtime yet.
 */
export const attributeOptions = pgTable(
  'attribute_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 60 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    image: varchar('image', { length: 500 }),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    subcategoryIds: jsonb('subcategory_ids')
      .$type<string[]>()
      .default([])
      .notNull(),
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
    uniqueIndex('attribute_options_type_slug_uq').on(t.type, t.slug),
    index('attribute_options_type_idx').on(t.type),
  ],
);

export type AttributeOptionRow = typeof attributeOptions.$inferSelect;
export type NewAttributeOption = typeof attributeOptions.$inferInsert;
