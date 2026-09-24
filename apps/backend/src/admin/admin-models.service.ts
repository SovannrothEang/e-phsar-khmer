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
import { models, modelSubcategoryLinks } from '../db/schema/brands.schema';
import type { ModelRow } from '../db/schema/brands.schema';
import type { CreateModelDto } from './dto/create-model.dto';
import type { UpdateModelDto } from './dto/update-model.dto';
import { FilesService } from '../files/files.service';

/** A model row plus the subcategories it belongs to. */
export interface AdminModel extends ModelRow {
  subcategoryIds: string[];
}

@Injectable()
export class AdminModelsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly files: FilesService,
  ) {}

  async list(brandId?: string): Promise<AdminModel[]> {
    const rows = await this.db
      .select()
      .from(models)
      .where(brandId ? eq(models.brandId, brandId) : undefined)
      .orderBy(asc(models.sortOrder));

    const links = await this.db
      .select({
        modelId: modelSubcategoryLinks.modelId,
        subcategoryId: modelSubcategoryLinks.subcategoryId,
      })
      .from(modelSubcategoryLinks);

    const byModel = new Map<string, string[]>();
    for (const l of links) {
      const entry = byModel.get(l.modelId) ?? [];
      entry.push(l.subcategoryId);
      byModel.set(l.modelId, entry);
    }

    return rows.map((m) => ({ ...m, subcategoryIds: byModel.get(m.id) ?? [] }));
  }

  async getOne(id: string): Promise<AdminModel> {
    const [row] = await this.db
      .select()
      .from(models)
      .where(eq(models.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Model not found');

    const links = await this.db
      .select({ subcategoryId: modelSubcategoryLinks.subcategoryId })
      .from(modelSubcategoryLinks)
      .where(eq(modelSubcategoryLinks.modelId, id));

    return { ...row, subcategoryIds: links.map((l) => l.subcategoryId) };
  }

  async create(dto: CreateModelDto): Promise<AdminModel> {
    let modelId: string;
    try {
      modelId = await this.db.transaction(async (tx) => {
        const [model] = await tx
          .insert(models)
          .values({
            brandId: dto.brandId,
            slug: dto.slug,
            name: dto.name,
            image: dto.image ?? null,
            sortOrder: dto.sortOrder ?? 0,
            isActive: dto.isActive ?? true,
          })
          .returning({ id: models.id });

        if (dto.subcategoryIds?.length) {
          await tx.insert(modelSubcategoryLinks).values(
            dto.subcategoryIds.map((subcategoryId) => ({
              modelId: model.id,
              subcategoryId,
            })),
          );
        }
        return model.id;
      });
    } catch (err) {
      this.rethrow(err);
    }
    return this.getOne(modelId);
  }

  async update(id: string, dto: UpdateModelDto): Promise<AdminModel> {
    const patch: Partial<ModelRow> = {};
    if (dto.brandId !== undefined) patch.brandId = dto.brandId;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.image !== undefined) patch.image = dto.image;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    let oldImage: string | null = null;
    try {
      await this.db.transaction(async (tx) => {
        const [prior] = await tx
          .select({ image: models.image })
          .from(models)
          .where(eq(models.id, id))
          .limit(1);
        if (!prior) throw new NotFoundException('Model not found');
        oldImage = prior.image;

        if (Object.keys(patch).length > 0) {
          await tx.update(models).set(patch).where(eq(models.id, id));
        }

        // When provided (even empty), this replaces the model's links — the
        // same delete-then-reinsert contract `brand_subcategory_links` uses.
        if (dto.subcategoryIds !== undefined) {
          await tx
            .delete(modelSubcategoryLinks)
            .where(eq(modelSubcategoryLinks.modelId, id));
          if (dto.subcategoryIds.length) {
            await tx.insert(modelSubcategoryLinks).values(
              dto.subcategoryIds.map((subcategoryId) => ({
                modelId: id,
                subcategoryId,
              })),
            );
          }
        }
      });
    } catch (err) {
      this.rethrow(err);
    }
    if (dto.image !== undefined && oldImage && dto.image !== oldImage) {
      await this.files.removeByPublicUrl(oldImage);
    }
    return this.getOne(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    const [existing] = await this.db
      .select({ image: models.image })
      .from(models)
      .where(eq(models.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Model not found');

    await this.db.delete(models).where(eq(models.id, id));
    await this.files.removeByPublicUrl(existing.image);
    return { id };
  }

  private rethrow(err: unknown): never {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === '23505') {
      throw new ConflictException(
        'A model with this slug already exists for that brand',
      );
    }
    if (code === '23503') {
      throw new BadRequestException(
        'brandId or subcategoryIds contains an unknown id',
      );
    }
    throw err;
  }
}
