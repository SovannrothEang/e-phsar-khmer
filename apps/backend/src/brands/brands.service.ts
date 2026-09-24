import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, notInArray, or } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import {
  brands,
  brandSubcategoryLinks,
  models,
  modelSubcategoryLinks,
} from '../db/schema/brands.schema';
import { subcategories } from '../db/schema/categories.schema';

export interface BrandDto {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sortOrder: number;
}

export interface ModelDto {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  sortOrder: number;
}

@Injectable()
export class BrandsService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async listBrands(subcategorySlug?: string): Promise<BrandDto[]> {
    if (!subcategorySlug) {
      return this.db
        .select({
          id: brands.id,
          slug: brands.slug,
          name: brands.name,
          icon: brands.icon,
          sortOrder: brands.sortOrder,
        })
        .from(brands)
        .where(eq(brands.isActive, true))
        .orderBy(asc(brands.sortOrder));
    }

    const [sub] = await this.db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(eq(subcategories.slug, subcategorySlug))
      .limit(1);

    if (!sub) return [];

    return this.db
      .select({
        id: brands.id,
        slug: brands.slug,
        name: brands.name,
        icon: brands.icon,
        sortOrder: brands.sortOrder,
      })
      .from(brands)
      .innerJoin(
        brandSubcategoryLinks,
        eq(brandSubcategoryLinks.brandId, brands.id),
      )
      .where(
        and(
          eq(brandSubcategoryLinks.subcategoryId, sub.id),
          eq(brands.isActive, true),
        ),
      )
      .orderBy(asc(brands.sortOrder));
  }

  /**
   * A brand's models, optionally narrowed to one subcategory.
   *
   * Without `subcategorySlug` this returns the brand's whole catalogue, which
   * is what the admin Models page wants.
   *
   * With it, the rule is: models linked to that subcategory, **plus models
   * with no link at all**. Including the unlinked ones is deliberate and
   * mirrors the managed/global rule the listing form's option sets use
   * (`forSub` in `apps/web/actions/listings.ts`) — an unclassified or
   * admin-created model must never silently empty a picker. A model linked to
   * a *different* subcategory is excluded, which is the point: Tablets under
   * Apple must not list iPhones.
   */
  async listModels(
    brandId: string,
    subcategorySlug?: string,
  ): Promise<ModelDto[]> {
    const base = {
      id: models.id,
      slug: models.slug,
      name: models.name,
      image: models.image,
      sortOrder: models.sortOrder,
    };

    if (!subcategorySlug) {
      return this.db
        .select(base)
        .from(models)
        .where(and(eq(models.brandId, brandId), eq(models.isActive, true)))
        .orderBy(asc(models.sortOrder));
    }

    const [sub] = await this.db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(eq(subcategories.slug, subcategorySlug))
      .limit(1);

    if (!sub) return [];

    const linkedToThis = this.db
      .select({ id: modelSubcategoryLinks.modelId })
      .from(modelSubcategoryLinks)
      .where(eq(modelSubcategoryLinks.subcategoryId, sub.id));

    // Having ANY link at all is what marks a model as classified.
    const linkedAnywhere = this.db
      .select({ id: modelSubcategoryLinks.modelId })
      .from(modelSubcategoryLinks);

    // "linked here OR not classified at all". Testing `ne(subcategoryId, sub.id)`
    // instead would be wrong: a model linked to two subcategories would be
    // excluded from both, which is the case the link table exists for.
    return this.db
      .select(base)
      .from(models)
      .where(
        and(
          eq(models.brandId, brandId),
          eq(models.isActive, true),
          or(
            inArray(models.id, linkedToThis),
            notInArray(models.id, linkedAnywhere),
          ),
        ),
      )
      .orderBy(asc(models.sortOrder));
  }
}
