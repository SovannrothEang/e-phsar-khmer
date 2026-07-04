import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import {
  categories,
  subcategories,
  categoryTranslations,
  subcategoryTranslations,
} from '../db/schema/categories.schema';
import type { SupportedLocale } from './locale.util';

export type { SupportedLocale };

export interface SubcategoryDto {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description: string | null;
  fieldSchema: unknown;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  subcategories: SubcategoryDto[];
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async listCategories(locale: SupportedLocale): Promise<CategoryDto[]> {
    const reqCatTr = alias(categoryTranslations, 'req_cat_tr');
    const enCatTr = alias(categoryTranslations, 'en_cat_tr');

    const catRows = await this.db
      .select({
        cat: categories,
        reqName: reqCatTr.name,
        reqDesc: reqCatTr.description,
        enName: enCatTr.name,
        enDesc: enCatTr.description,
      })
      .from(categories)
      .leftJoin(
        reqCatTr,
        and(
          eq(reqCatTr.categoryId, categories.id),
          eq(reqCatTr.locale, locale),
        ),
      )
      .leftJoin(
        enCatTr,
        and(eq(enCatTr.categoryId, categories.id), eq(enCatTr.locale, 'en')),
      )
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder));

    const reqSubTr = alias(subcategoryTranslations, 'req_sub_tr');
    const enSubTr = alias(subcategoryTranslations, 'en_sub_tr');

    const subRows = await this.db
      .select({
        sub: subcategories,
        reqName: reqSubTr.name,
        reqDesc: reqSubTr.description,
        enName: enSubTr.name,
        enDesc: enSubTr.description,
      })
      .from(subcategories)
      .leftJoin(
        reqSubTr,
        and(
          eq(reqSubTr.subcategoryId, subcategories.id),
          eq(reqSubTr.locale, locale),
        ),
      )
      .leftJoin(
        enSubTr,
        and(
          eq(enSubTr.subcategoryId, subcategories.id),
          eq(enSubTr.locale, 'en'),
        ),
      )
      .where(eq(subcategories.isActive, true))
      .orderBy(asc(subcategories.sortOrder));

    return catRows.map((row) => ({
      ...row.cat,
      name: row.reqName ?? row.enName ?? row.cat.slug,
      description: row.reqDesc ?? row.enDesc ?? null,
      subcategories: subRows
        .filter((s) => s.sub.categoryId === row.cat.id)
        .map((s) => ({
          ...s.sub,
          name: s.reqName ?? s.enName ?? s.sub.slug,
          description: s.reqDesc ?? s.enDesc ?? null,
        })),
    }));
  }

  async getCategoryBySlug(
    slug: string,
    locale: SupportedLocale,
  ): Promise<CategoryDto> {
    const reqCatTr = alias(categoryTranslations, 'req_cat_tr');
    const enCatTr = alias(categoryTranslations, 'en_cat_tr');

    const [catRow] = await this.db
      .select({
        cat: categories,
        reqName: reqCatTr.name,
        reqDesc: reqCatTr.description,
        enName: enCatTr.name,
        enDesc: enCatTr.description,
      })
      .from(categories)
      .leftJoin(
        reqCatTr,
        and(
          eq(reqCatTr.categoryId, categories.id),
          eq(reqCatTr.locale, locale),
        ),
      )
      .leftJoin(
        enCatTr,
        and(eq(enCatTr.categoryId, categories.id), eq(enCatTr.locale, 'en')),
      )
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!catRow) throw new NotFoundException(`Category '${slug}' not found`);

    const reqSubTr = alias(subcategoryTranslations, 'req_sub_tr');
    const enSubTr = alias(subcategoryTranslations, 'en_sub_tr');

    const subRows = await this.db
      .select({
        sub: subcategories,
        reqName: reqSubTr.name,
        reqDesc: reqSubTr.description,
        enName: enSubTr.name,
        enDesc: enSubTr.description,
      })
      .from(subcategories)
      .leftJoin(
        reqSubTr,
        and(
          eq(reqSubTr.subcategoryId, subcategories.id),
          eq(reqSubTr.locale, locale),
        ),
      )
      .leftJoin(
        enSubTr,
        and(
          eq(enSubTr.subcategoryId, subcategories.id),
          eq(enSubTr.locale, 'en'),
        ),
      )
      .where(eq(subcategories.categoryId, catRow.cat.id))
      .orderBy(asc(subcategories.sortOrder));

    return {
      ...catRow.cat,
      name: catRow.reqName ?? catRow.enName ?? catRow.cat.slug,
      description: catRow.reqDesc ?? catRow.enDesc ?? null,
      subcategories: subRows.map((s) => ({
        ...s.sub,
        name: s.reqName ?? s.enName ?? s.sub.slug,
        description: s.reqDesc ?? s.enDesc ?? null,
      })),
    };
  }

  async getSubcategory(
    categorySlug: string,
    subSlug: string,
    locale: SupportedLocale,
  ): Promise<SubcategoryDto> {
    const cat = await this.getCategoryBySlug(categorySlug, locale);

    const reqSubTr = alias(subcategoryTranslations, 'req_sub_tr');
    const enSubTr = alias(subcategoryTranslations, 'en_sub_tr');

    const [row] = await this.db
      .select({
        sub: subcategories,
        reqName: reqSubTr.name,
        reqDesc: reqSubTr.description,
        enName: enSubTr.name,
        enDesc: enSubTr.description,
      })
      .from(subcategories)
      .leftJoin(
        reqSubTr,
        and(
          eq(reqSubTr.subcategoryId, subcategories.id),
          eq(reqSubTr.locale, locale),
        ),
      )
      .leftJoin(
        enSubTr,
        and(
          eq(enSubTr.subcategoryId, subcategories.id),
          eq(enSubTr.locale, 'en'),
        ),
      )
      .where(eq(subcategories.slug, subSlug))
      .limit(1);

    if (!row || row.sub.categoryId !== cat.id) {
      throw new NotFoundException(`Subcategory '${subSlug}' not found`);
    }

    return {
      ...row.sub,
      name: row.reqName ?? row.enName ?? row.sub.slug,
      description: row.reqDesc ?? row.enDesc ?? null,
    };
  }
}
