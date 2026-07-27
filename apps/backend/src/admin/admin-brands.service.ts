import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { brands, brandSubcategoryLinks } from '../db/schema/brands.schema';
import type { BrandRow } from '../db/schema/brands.schema';
import { subcategories } from '../db/schema/categories.schema';
import type { CreateBrandDto } from './dto/create-brand.dto';
import type { UpdateBrandDto } from './dto/update-brand.dto';
import { FilesService } from '../files/files.service';

export interface AdminBrand {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  subcategoryIds: string[];
  categoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AdminBrandsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly files: FilesService,
  ) {}

  async list(): Promise<AdminBrand[]> {
    const brandRows = await this.db
      .select()
      .from(brands)
      .orderBy(asc(brands.sortOrder));

    const links = await this.db
      .select({
        brandId: brandSubcategoryLinks.brandId,
        subcategoryId: brandSubcategoryLinks.subcategoryId,
        categoryId: subcategories.categoryId,
      })
      .from(brandSubcategoryLinks)
      .innerJoin(
        subcategories,
        eq(subcategories.id, brandSubcategoryLinks.subcategoryId),
      );

    const byBrand = new Map<
      string,
      { subs: string[]; categoryId: string | null }
    >();
    for (const l of links) {
      const entry = byBrand.get(l.brandId) ?? { subs: [], categoryId: null };
      entry.subs.push(l.subcategoryId);
      if (!entry.categoryId) entry.categoryId = l.categoryId;
      byBrand.set(l.brandId, entry);
    }

    return brandRows.map((b) => this.shape(b, byBrand.get(b.id)));
  }

  async create(dto: CreateBrandDto): Promise<AdminBrand> {
    let brandId: string;
    try {
      brandId = await this.db.transaction(async (tx) => {
        const [brand] = await tx
          .insert(brands)
          .values({
            slug: dto.slug,
            name: dto.name,
            icon: dto.icon ?? null,
            sortOrder: dto.sortOrder ?? 0,
            isActive: dto.isActive ?? true,
          })
          .returning({ id: brands.id });

        if (dto.subcategoryIds?.length) {
          await tx.insert(brandSubcategoryLinks).values(
            dto.subcategoryIds.map((subcategoryId) => ({
              brandId: brand.id,
              subcategoryId,
            })),
          );
        }
        return brand.id;
      });
    } catch (err) {
      this.rethrow(err);
    }
    return this.getOne(brandId);
  }

  async update(id: string, dto: UpdateBrandDto): Promise<AdminBrand> {
    let oldIcon: string | null = null;
    try {
      await this.db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ id: brands.id, icon: brands.icon })
          .from(brands)
          .where(eq(brands.id, id))
          .limit(1);
        if (!existing) throw new NotFoundException('Brand not found');
        oldIcon = existing.icon;

        const patch: Partial<BrandRow> = {};
        if (dto.slug !== undefined) patch.slug = dto.slug;
        if (dto.name !== undefined) patch.name = dto.name;
        if (dto.icon !== undefined) patch.icon = dto.icon;
        if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
        if (dto.isActive !== undefined) patch.isActive = dto.isActive;
        if (Object.keys(patch).length > 0) {
          await tx.update(brands).set(patch).where(eq(brands.id, id));
        }

        if (dto.subcategoryIds !== undefined) {
          await tx
            .delete(brandSubcategoryLinks)
            .where(eq(brandSubcategoryLinks.brandId, id));
          if (dto.subcategoryIds.length) {
            await tx.insert(brandSubcategoryLinks).values(
              dto.subcategoryIds.map((subcategoryId) => ({
                brandId: id,
                subcategoryId,
              })),
            );
          }
        }
      });
    } catch (err) {
      this.rethrow(err);
    }
    if (dto.icon !== undefined && oldIcon && dto.icon !== oldIcon) {
      await this.files.removeByPublicUrl(oldIcon);
    }
    return this.getOne(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    const [existing] = await this.db
      .select({ icon: brands.icon })
      .from(brands)
      .where(eq(brands.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Brand not found');

    await this.db.delete(brands).where(eq(brands.id, id));
    await this.files.removeByPublicUrl(existing.icon);
    return { id };
  }

  private async getOne(id: string): Promise<AdminBrand> {
    const [brand] = await this.db
      .select()
      .from(brands)
      .where(eq(brands.id, id))
      .limit(1);
    if (!brand) throw new NotFoundException('Brand not found');

    const links = await this.db
      .select({
        subcategoryId: brandSubcategoryLinks.subcategoryId,
        categoryId: subcategories.categoryId,
      })
      .from(brandSubcategoryLinks)
      .innerJoin(
        subcategories,
        eq(subcategories.id, brandSubcategoryLinks.subcategoryId),
      )
      .where(eq(brandSubcategoryLinks.brandId, id));

    return this.shape(brand, {
      subs: links.map((l) => l.subcategoryId),
      categoryId: links[0]?.categoryId ?? null,
    });
  }

  private shape(
    b: BrandRow,
    entry?: { subs: string[]; categoryId: string | null },
  ): AdminBrand {
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      icon: b.icon,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      subcategoryIds: entry?.subs ?? [],
      categoryId: entry?.categoryId ?? null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  private rethrow(err: unknown): never {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === '23505') {
      throw new ConflictException('A brand with this slug already exists');
    }
    if (code === '23503') {
      throw new BadRequestException('subcategoryIds contains an unknown id');
    }
    throw err;
  }
}
