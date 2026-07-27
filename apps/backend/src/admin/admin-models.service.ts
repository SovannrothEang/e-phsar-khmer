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
import { models } from '../db/schema/brands.schema';
import type { ModelRow } from '../db/schema/brands.schema';
import type { CreateModelDto } from './dto/create-model.dto';
import type { UpdateModelDto } from './dto/update-model.dto';
import { FilesService } from '../files/files.service';

@Injectable()
export class AdminModelsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly files: FilesService,
  ) {}

  async list(brandId?: string): Promise<ModelRow[]> {
    return this.db
      .select()
      .from(models)
      .where(brandId ? eq(models.brandId, brandId) : undefined)
      .orderBy(asc(models.sortOrder));
  }

  async create(dto: CreateModelDto): Promise<ModelRow> {
    try {
      const [model] = await this.db
        .insert(models)
        .values({
          brandId: dto.brandId,
          slug: dto.slug,
          name: dto.name,
          image: dto.image ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        })
        .returning();
      return model;
    } catch (err) {
      this.rethrow(err);
    }
  }

  async update(id: string, dto: UpdateModelDto): Promise<ModelRow> {
    const patch: Partial<ModelRow> = {};
    if (dto.brandId !== undefined) patch.brandId = dto.brandId;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.image !== undefined) patch.image = dto.image;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    try {
      const [prior] = await this.db
        .select({ image: models.image })
        .from(models)
        .where(eq(models.id, id))
        .limit(1);
      const oldImage = prior?.image ?? null;

      const rows =
        Object.keys(patch).length > 0
          ? await this.db
              .update(models)
              .set(patch)
              .where(eq(models.id, id))
              .returning()
          : await this.db.select().from(models).where(eq(models.id, id));
      if (rows.length === 0) throw new NotFoundException('Model not found');

      if (dto.image !== undefined && oldImage && dto.image !== oldImage) {
        await this.files.removeByPublicUrl(oldImage);
      }
      return rows[0];
    } catch (err) {
      this.rethrow(err);
    }
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
      throw new BadRequestException('brandId does not exist');
    }
    throw err;
  }
}
