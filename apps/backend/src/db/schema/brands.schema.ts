import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { subcategories } from './categories.schema';

export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 80 }).unique().notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  icon: varchar('icon', { length: 500 }),
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

export const models = pgTable(
  'models',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 100 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    image: varchar('image', { length: 500 }),
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
    uniqueIndex('models_brand_slug_uq').on(t.brandId, t.slug),
    index('models_brand_id_idx').on(t.brandId),
  ],
);

export const brandSubcategoryLinks = pgTable(
  'brand_subcategory_links',
  {
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    subcategoryId: uuid('subcategory_id')
      .notNull()
      .references(() => subcategories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.brandId, t.subcategoryId] }),
    index('brand_subcategory_links_subcategory_id_idx').on(t.subcategoryId),
    index('brand_subcategory_links_brand_id_idx').on(t.brandId),
  ],
);

/**
 * Which subcategories a model belongs to — the same relationship
 * `brand_subcategory_links` records one level down, and the reason it exists:
 * `models` is keyed by `(brand_id, slug)` alone, so without this the API could
 * not tell an iPad from an iPhone and `GET /brands/:id/models` returned the
 * brand's whole catalogue for every subcategory (`iPad` under Smart Watches,
 * Xiaomi's phones under Cars For Sale).
 *
 * A model may belong to more than one (Surface Pro is a tablet and a laptop;
 * an iMac is a desktop and an all-in-one), hence a link table rather than a
 * column on `models`.
 */
export const modelSubcategoryLinks = pgTable(
  'model_subcategory_links',
  {
    modelId: uuid('model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    subcategoryId: uuid('subcategory_id')
      .notNull()
      .references(() => subcategories.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.modelId, t.subcategoryId] }),
    index('model_subcategory_links_subcategory_id_idx').on(t.subcategoryId),
    index('model_subcategory_links_model_id_idx').on(t.modelId),
  ],
);

export type BrandRow = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type ModelRow = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
export type BrandSubcategoryLinkRow = typeof brandSubcategoryLinks.$inferSelect;
export type NewBrandSubcategoryLink = typeof brandSubcategoryLinks.$inferInsert;
export type ModelSubcategoryLinkRow = typeof modelSubcategoryLinks.$inferSelect;
export type NewModelSubcategoryLink = typeof modelSubcategoryLinks.$inferInsert;
