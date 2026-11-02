import { and, eq } from 'drizzle-orm';
import type { DbClient } from '../../db/drizzle.provider';
import {
  brands,
  brandSubcategoryLinks,
  models,
  modelSubcategoryLinks,
} from '../../db/schema/brands.schema';
import { subcategories } from '../../db/schema/categories.schema';
import {
  productSpecs,
  type ProductSpecFamily,
} from '../../db/schema/products.schema';
import { CAR_CATALOG, PHONE_CATALOG } from './catalog';

/**
 * Same slug rule as `seedModels` (brands.seed.ts): "+" is spelled out, every
 * other run of non-alphanumerics collapses to one hyphen.
 */
export function modelSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface SpecTarget {
  family: ProductSpecFamily;
  subcategorySlug: string;
  brandSlug: string;
  modelName: string;
  specGroups: (typeof CAR_CATALOG)[number]['specGroups'];
}

/**
 * Trusted spec pages for the demo catalogue (2026-11-01). Insert-only like the
 * rest of the seeds: a model/spec row that already exists is never touched, so
 * an admin's edits to a spec page survive a re-seed. Must run after
 * `seedModels` (brands + the starter models exist) and before `seedListings`
 * (the demo listings link to these pages through `product_model_id`).
 */
export async function seedProducts(db: DbClient): Promise<void> {
  const targets: SpecTarget[] = [
    ...CAR_CATALOG.map(
      (c): SpecTarget => ({
        family: 'car',
        subcategorySlug: 'cars-for-sale',
        brandSlug: c.brandSlug,
        modelName: c.modelName,
        specGroups: c.specGroups,
      }),
    ),
    ...PHONE_CATALOG.map(
      (p): SpecTarget => ({
        family: 'phone',
        subcategorySlug: 'phones',
        brandSlug: p.brandSlug,
        modelName: p.modelName,
        specGroups: p.specGroups,
      }),
    ),
  ];

  const [brandRows, subRows] = await Promise.all([
    db.select({ id: brands.id, slug: brands.slug }).from(brands),
    db
      .select({ id: subcategories.id, slug: subcategories.slug })
      .from(subcategories),
  ]);
  const brandId = new Map(brandRows.map((b) => [b.slug, b.id]));
  const subId = new Map(subRows.map((s) => [s.slug, s.id]));

  let created = 0;
  for (const t of targets) {
    const bId = brandId.get(t.brandSlug);
    const sId = subId.get(t.subcategorySlug);
    if (!bId || !sId) {
      console.warn(
        `  ✗ skipped spec "${t.brandSlug} ${t.modelName}" (missing brand or subcategory)`,
      );
      continue;
    }

    const slug = modelSlug(t.modelName);
    await db
      .insert(models)
      .values({ brandId: bId, slug, name: t.modelName })
      .onConflictDoNothing();
    const [model] = await db
      .select({ id: models.id })
      .from(models)
      .where(and(eq(models.brandId, bId), eq(models.slug, slug)))
      .limit(1);
    if (!model) continue;

    // Reachable in the post form's pickers: brand and model both linked to the
    // family's subcategory.
    await db
      .insert(brandSubcategoryLinks)
      .values({ brandId: bId, subcategoryId: sId })
      .onConflictDoNothing();
    await db
      .insert(modelSubcategoryLinks)
      .values({ modelId: model.id, subcategoryId: sId })
      .onConflictDoNothing();

    const inserted = await db
      .insert(productSpecs)
      .values({
        modelId: model.id,
        family: t.family,
        specGroups: t.specGroups,
        isPublished: true,
      })
      .onConflictDoNothing()
      .returning({ id: productSpecs.id });
    created += inserted.length;
  }
  console.log(`  ✓ seeded ${created} product spec pages`);
}
