import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { models } from './brands.schema';

/**
 * One label/value row inside a spec group ("Size" → "6.1\"").
 */
export interface ProductSpecItem {
  label: string;
  value: string;
}

/**
 * A GSMArena-style spec section ("Display", "Camera", …). Array order is the
 * display order — Postgres preserves JSONB array order, so no sort columns.
 */
export interface ProductSpecGroup {
  title: string;
  rows: ProductSpecItem[];
}

/**
 * The trusted product-spec page. Identity is the existing `models` row (brand +
 * model name/slug/image); this table only adds the admin-entered spec data, so
 * a listing, the brand/model pickers and the spec page can never disagree
 * about what "iPhone 16" is. One spec page per model (`model_id` unique).
 */
export const productSpecs = pgTable(
  'product_specs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    specGroups: jsonb('spec_groups')
      .$type<ProductSpecGroup[]>()
      .default([])
      .notNull(),
    // Draft pages are invisible to the public API and to the post form picker;
    // creating one defaults to draft so an admin can build it before posters
    // can attach to it.
    isPublished: boolean('is_published').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('product_specs_model_id_uq').on(t.modelId),
    index('product_specs_is_published_idx').on(t.isPublished),
  ],
);

export type ProductSpecRow = typeof productSpecs.$inferSelect;
export type NewProductSpec = typeof productSpecs.$inferInsert;
