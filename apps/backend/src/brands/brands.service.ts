import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import {
  brands,
  brandSubcategoryLinks,
  models,
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

  async listModels(brandId: string): Promise<ModelDto[]> {
    return this.db
      .select({
        id: models.id,
        slug: models.slug,
        name: models.name,
        image: models.image,
        sortOrder: models.sortOrder,
      })
      .from(models)
      .where(and(eq(models.brandId, brandId), eq(models.isActive, true)))
      .orderBy(asc(models.sortOrder));
  }
}
