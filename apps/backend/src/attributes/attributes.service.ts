import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { attributeOptions } from '../db/schema/attributes.schema';
import type { AttributeOptionRow } from '../db/schema/attributes.schema';
import type { CreateAttributeDto } from './dto/create-attribute.dto';
import type { UpdateAttributeDto } from './dto/update-attribute.dto';
import { FilesService } from '../files/files.service';

@Injectable()
export class AttributesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly files: FilesService,
  ) {}

  list(type: string): Promise<AttributeOptionRow[]> {
    return this.db
      .select()
      .from(attributeOptions)
      .where(eq(attributeOptions.type, type))
      .orderBy(asc(attributeOptions.sortOrder));
  }

  async create(
    type: string,
    dto: CreateAttributeDto,
  ): Promise<AttributeOptionRow> {
    try {
      const [row] = await this.db
        .insert(attributeOptions)
        .values({
          type,
          name: dto.name,
          slug: dto.slug,
          image: dto.image ?? null,
          categoryId: dto.categoryId ?? null,
          subcategoryIds: dto.subcategoryIds ?? [],
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        })
        .returning();
      return row;
    } catch (err) {
      this.rethrow(err);
    }
  }

  async update(
    type: string,
    id: string,
    dto: UpdateAttributeDto,
  ): Promise<AttributeOptionRow> {
    const patch: Partial<AttributeOptionRow> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.image !== undefined) patch.image = dto.image;
    if (dto.categoryId !== undefined) patch.categoryId = dto.categoryId;
    if (dto.subcategoryIds !== undefined)
      patch.subcategoryIds = dto.subcategoryIds;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    const where = and(
      eq(attributeOptions.id, id),
      eq(attributeOptions.type, type),
    );

    try {
      const [prior] = await this.db
        .select({ image: attributeOptions.image })
        .from(attributeOptions)
        .where(where)
        .limit(1);
      const oldImage = prior?.image ?? null;

      const rows =
        Object.keys(patch).length > 0
          ? await this.db
              .update(attributeOptions)
              .set(patch)
              .where(where)
              .returning()
          : await this.db.select().from(attributeOptions).where(where);
      if (rows.length === 0) throw new NotFoundException('Attribute not found');

      if (dto.image !== undefined && oldImage && dto.image !== oldImage) {
        await this.files.removeByPublicUrl(oldImage);
      }
      return rows[0];
    } catch (err) {
      this.rethrow(err);
    }
  }

  async remove(type: string, id: string): Promise<{ id: string }> {
    const [existing] = await this.db
      .select({ image: attributeOptions.image })
      .from(attributeOptions)
      .where(and(eq(attributeOptions.id, id), eq(attributeOptions.type, type)))
      .limit(1);
    if (!existing) throw new NotFoundException('Attribute not found');

    await this.db.delete(attributeOptions).where(eq(attributeOptions.id, id));
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
        'An option with this slug already exists for that type',
      );
    }
    if (code === '23503') {
      throw new BadRequestException('categoryId does not exist');
    }
    throw err;
  }
}
