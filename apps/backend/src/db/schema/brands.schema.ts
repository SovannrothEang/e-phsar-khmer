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
  icon: varchar('icon', { length: 120 }),
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

export type BrandRow = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type ModelRow = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
export type BrandSubcategoryLinkRow = typeof brandSubcategoryLinks.$inferSelect;
export type NewBrandSubcategoryLink = typeof brandSubcategoryLinks.$inferInsert;
