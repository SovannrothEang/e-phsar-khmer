import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { brands, models } from '../db/schema/brands.schema';
import { productSpecs } from '../db/schema/products.schema';
import type {
  NewProductSpec,
  ProductSpecGroup,
} from '../db/schema/products.schema';
import { likeTerm } from '../utils/like-term';
import type { CreateProductDto } from './dto/create-product.dto';
import type { QueryProductsDto } from './dto/query-products.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

/** Mirrors the listing keyword search's cap — enough words, bounded work. */
const MAX_SEARCH_TOKENS = 5;

/** What a listing detail embeds: just enough to render the specs link. */
export interface ProductRef {
  modelId: string;
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
}

/** Search result / picker row. */
export interface PublicProductSummary extends ProductRef {
  id: string;
  brandId: string;
  image: string | null;
}

/** Full public spec page. */
export interface PublicProduct extends PublicProductSummary {
  specGroups: ProductSpecGroup[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin rows carry the same shape as the public page (plus drafts). */
export type AdminProduct = PublicProduct;

const detailFields = {
  id: productSpecs.id,
  modelId: productSpecs.modelId,
  brandId: brands.id,
  brandSlug: brands.slug,
  brandName: brands.name,
  modelSlug: models.slug,
  modelName: models.name,
  image: models.image,
  specGroups: productSpecs.specGroups,
  isPublished: productSpecs.isPublished,
  createdAt: productSpecs.createdAt,
  updatedAt: productSpecs.updatedAt,
};

@Injectable()
export class ProductsService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  /**
   * A page is visible to the public (and attachable from the post form) only
   * when the spec is published AND both catalogue rows are active — an
   * unpublished page must not leak through a direct URL, and a deactivated
   * brand/model must disappear from search instead of advertising itself.
   */
  private visibility(): SQL[] {
    return [
      eq(productSpecs.isPublished, true),
      eq(models.isActive, true),
      eq(brands.isActive, true),
    ];
  }

  async listPublished(
    query: QueryProductsDto = {},
  ): Promise<PublicProductSummary[]> {
    const conditions = this.visibility();
    const q = query.q?.trim();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TOKENS);
      for (const token of tokens) {
        const term = likeTerm(token);
        conditions.push(
          or(
            ilike(brands.name, term),
            ilike(brands.slug, term),
            ilike(models.name, term),
            ilike(models.slug, term),
          )!,
        );
      }
    }

    return this.db
      .select({
        id: productSpecs.id,
        modelId: productSpecs.modelId,
        brandId: brands.id,
        brandSlug: brands.slug,
        brandName: brands.name,
        modelSlug: models.slug,
        modelName: models.name,
        image: models.image,
      })
      .from(productSpecs)
      .innerJoin(models, eq(models.id, productSpecs.modelId))
      .innerJoin(brands, eq(brands.id, models.brandId))
      .where(and(...conditions))
      .orderBy(asc(brands.name), asc(models.sortOrder), asc(models.name))
      .limit(query.limit ?? 10);
  }

  async getPublishedBySlug(
    brandSlug: string,
    modelSlug: string,
  ): Promise<PublicProduct> {
    const [row] = await this.db
      .select(detailFields)
      .from(productSpecs)
      .innerJoin(models, eq(models.id, productSpecs.modelId))
      .innerJoin(brands, eq(brands.id, models.brandId))
      .where(
        and(
          eq(brands.slug, brandSlug),
          eq(models.slug, modelSlug),
          ...this.visibility(),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async listAdmin(): Promise<AdminProduct[]> {
    return this.db
      .select(detailFields)
      .from(productSpecs)
      .innerJoin(models, eq(models.id, productSpecs.modelId))
      .innerJoin(brands, eq(brands.id, models.brandId))
      .orderBy(asc(brands.name), asc(models.sortOrder), asc(models.name));
  }

  async createAdmin(dto: CreateProductDto): Promise<AdminProduct> {
    const specGroups = this.normalizeGroups(dto.specGroups);
    let id: string;
    try {
      const [row] = await this.db
        .insert(productSpecs)
        .values({
          modelId: dto.modelId,
          specGroups,
          isPublished: dto.isPublished ?? true,
        })
        .returning({ id: productSpecs.id });
      id = row.id;
    } catch (err) {
      this.mapWriteError(err);
    }
    return this.getAdminOne(id!);
  }

  async updateAdmin(id: string, dto: UpdateProductDto): Promise<AdminProduct> {
    const patch: Partial<NewProductSpec> = {};
    if (dto.specGroups !== undefined) {
      patch.specGroups = this.normalizeGroups(dto.specGroups);
    }
    if (dto.isPublished !== undefined) patch.isPublished = dto.isPublished;

    const [existing] = await this.db
      .select({ id: productSpecs.id })
      .from(productSpecs)
      .where(eq(productSpecs.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Product spec not found');

    if (Object.keys(patch).length > 0) {
      await this.db
        .update(productSpecs)
        .set(patch)
        .where(eq(productSpecs.id, id));
    }
    return this.getAdminOne(id);
  }

  async removeAdmin(id: string): Promise<{ id: string }> {
    const [row] = await this.db
      .delete(productSpecs)
      .where(eq(productSpecs.id, id))
      .returning({ id: productSpecs.id });
    if (!row) throw new NotFoundException('Product spec not found');
    return row;
  }

  /**
   * Listing create/update gate: a listing may only point at a page the public
   * can actually open. Called before the write; see the TOCTOU note in the
   * plan (a publish flip in between hides the link, never corrupts the row).
   */
  async assertPublishedModel(modelId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: productSpecs.id })
      .from(productSpecs)
      .innerJoin(models, eq(models.id, productSpecs.modelId))
      .innerJoin(brands, eq(brands.id, models.brandId))
      .where(and(eq(productSpecs.modelId, modelId), ...this.visibility()))
      .limit(1);
    if (!row) {
      throw new BadRequestException(
        'productModelId must reference a published product spec',
      );
    }
  }

  /** Detail-page embed: null when unlinked, unpublished or catalogue-inactive. */
  async getPublishedRefByModelId(modelId: string): Promise<ProductRef | null> {
    const [row] = await this.db
      .select({
        modelId: productSpecs.modelId,
        brandSlug: brands.slug,
        brandName: brands.name,
        modelSlug: models.slug,
        modelName: models.name,
      })
      .from(productSpecs)
      .innerJoin(models, eq(models.id, productSpecs.modelId))
      .innerJoin(brands, eq(brands.id, models.brandId))
      .where(and(eq(productSpecs.modelId, modelId), ...this.visibility()))
      .limit(1);
    return row ?? null;
  }

  private async getAdminOne(id: string): Promise<AdminProduct> {
    const [row] = await this.db
      .select(detailFields)
      .from(productSpecs)
      .innerJoin(models, eq(models.id, productSpecs.modelId))
      .innerJoin(brands, eq(brands.id, models.brandId))
      .where(eq(productSpecs.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Product spec not found');
    return row;
  }

  private normalizeGroups(groups: ProductSpecGroup[]): ProductSpecGroup[] {
    const normalized = groups.map((group) => ({
      title: group.title.trim(),
      rows: group.rows.map((row) => ({
        label: row.label.trim(),
        value: row.value.trim(),
      })),
    }));
    const hasEmpty = normalized.some(
      (group) =>
        !group.title || group.rows.some((row) => !row.label || !row.value),
    );
    if (hasEmpty) {
      throw new BadRequestException(
        'Spec titles, labels and values cannot be empty',
      );
    }
    return normalized;
  }

  /** Drizzle surfaces the pg error code; map the two we can act on. */
  private mapWriteError(err: unknown): never {
    if (err instanceof HttpException) throw err;
    const code = (err as { code?: string }).code;
    if (code === '23505') {
      throw new ConflictException(
        'A product spec already exists for this model',
      );
    }
    if (code === '23503') {
      throw new BadRequestException('modelId does not exist');
    }
    throw err;
  }
}
