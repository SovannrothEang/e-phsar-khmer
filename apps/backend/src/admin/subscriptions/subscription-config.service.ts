import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import {
  subscriptionCategories,
  subscriptionPlans,
  subscriptionPackages,
  subscriptionTerms,
} from '../../db/schema/subscriptions.schema';
import type {
  SubscriptionCategoryRow,
  SubscriptionPlanRow,
  SubscriptionPackageRow,
  SubscriptionTermRow,
} from '../../db/schema/subscriptions.schema';
import type {
  CreateSubCategoryDto,
  UpdateSubCategoryDto,
  CreateSubPlanDto,
  UpdateSubPlanDto,
  CreateSubPackageDto,
  UpdateSubPackageDto,
  CreateSubTermDto,
  UpdateSubTermDto,
} from './dto/subscription-config.dto';

@Injectable()
export class SubscriptionConfigService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  // ── Categories ──────────────────────────────────────────
  listCategories() {
    return this.db
      .select()
      .from(subscriptionCategories)
      .orderBy(asc(subscriptionCategories.sortOrder));
  }

  async createCategory(dto: CreateSubCategoryDto) {
    try {
      const [row] = await this.db
        .insert(subscriptionCategories)
        .values({
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        })
        .returning();
      return row;
    } catch (err) {
      this.rethrow(err);
    }
  }

  async updateCategory(id: string, dto: UpdateSubCategoryDto) {
    const patch: Partial<SubscriptionCategoryRow> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    try {
      const rows = Object.keys(patch).length
        ? await this.db
            .update(subscriptionCategories)
            .set(patch)
            .where(eq(subscriptionCategories.id, id))
            .returning()
        : await this.db
            .select()
            .from(subscriptionCategories)
            .where(eq(subscriptionCategories.id, id));
      if (!rows.length) throw new NotFoundException('Category not found');
      return rows[0];
    } catch (err) {
      this.rethrow(err);
    }
  }

  async removeCategory(id: string) {
    const [row] = await this.db
      .select({ id: subscriptionCategories.id })
      .from(subscriptionCategories)
      .where(eq(subscriptionCategories.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Category not found');
    await this.db
      .delete(subscriptionCategories)
      .where(eq(subscriptionCategories.id, id));
    return { id };
  }

  // ── Plans ───────────────────────────────────────────────
  listPlans(categoryId?: string) {
    return this.db
      .select()
      .from(subscriptionPlans)
      .where(
        categoryId ? eq(subscriptionPlans.categoryId, categoryId) : undefined,
      )
      .orderBy(asc(subscriptionPlans.sortOrder));
  }

  async createPlan(dto: CreateSubPlanDto) {
    try {
      const [row] = await this.db
        .insert(subscriptionPlans)
        .values({
          categoryId: dto.categoryId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        })
        .returning();
      return row;
    } catch (err) {
      this.rethrow(err);
    }
  }

  async updatePlan(id: string, dto: UpdateSubPlanDto) {
    const patch: Partial<SubscriptionPlanRow> = {};
    if (dto.categoryId !== undefined) patch.categoryId = dto.categoryId;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    try {
      const rows = Object.keys(patch).length
        ? await this.db
            .update(subscriptionPlans)
            .set(patch)
            .where(eq(subscriptionPlans.id, id))
            .returning()
        : await this.db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, id));
      if (!rows.length) throw new NotFoundException('Plan not found');
      return rows[0];
    } catch (err) {
      this.rethrow(err);
    }
  }

  async removePlan(id: string) {
    const [row] = await this.db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Plan not found');
    await this.db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return { id };
  }

  // ── Packages ────────────────────────────────────────────
  listPackages(planId?: string) {
    return this.db
      .select()
      .from(subscriptionPackages)
      .where(planId ? eq(subscriptionPackages.planId, planId) : undefined)
      .orderBy(asc(subscriptionPackages.sortOrder));
  }

  async createPackage(dto: CreateSubPackageDto) {
    try {
      const [row] = await this.db
        .insert(subscriptionPackages)
        .values({
          planId: dto.planId,
          name: dto.name,
          photos: dto.photos ?? 0,
          ads: dto.ads ?? 0,
          renews: dto.renews ?? 0,
          autoRenews: dto.autoRenews ?? 0,
          videos: dto.videos ?? 0,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        })
        .returning();
      return row;
    } catch (err) {
      this.rethrow(err);
    }
  }

  async updatePackage(id: string, dto: UpdateSubPackageDto) {
    const patch: Partial<SubscriptionPackageRow> = {};
    if (dto.planId !== undefined) patch.planId = dto.planId;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.photos !== undefined) patch.photos = dto.photos;
    if (dto.ads !== undefined) patch.ads = dto.ads;
    if (dto.renews !== undefined) patch.renews = dto.renews;
    if (dto.autoRenews !== undefined) patch.autoRenews = dto.autoRenews;
    if (dto.videos !== undefined) patch.videos = dto.videos;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    try {
      const rows = Object.keys(patch).length
        ? await this.db
            .update(subscriptionPackages)
            .set(patch)
            .where(eq(subscriptionPackages.id, id))
            .returning()
        : await this.db
            .select()
            .from(subscriptionPackages)
            .where(eq(subscriptionPackages.id, id));
      if (!rows.length) throw new NotFoundException('Package not found');
      return rows[0];
    } catch (err) {
      this.rethrow(err);
    }
  }

  async removePackage(id: string) {
    const [row] = await this.db
      .select({ id: subscriptionPackages.id })
      .from(subscriptionPackages)
      .where(eq(subscriptionPackages.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Package not found');
    await this.db
      .delete(subscriptionPackages)
      .where(eq(subscriptionPackages.id, id));
    return { id };
  }

  // ── Terms ───────────────────────────────────────────────
  listTerms(packageId?: string) {
    return this.db
      .select()
      .from(subscriptionTerms)
      .where(packageId ? eq(subscriptionTerms.packageId, packageId) : undefined)
      .orderBy(asc(subscriptionTerms.sortOrder));
  }

  async createTerm(dto: CreateSubTermDto) {
    try {
      const [row] = await this.db
        .insert(subscriptionTerms)
        .values({
          packageId: dto.packageId,
          name: dto.name,
          durationValue: dto.durationValue,
          durationUnit: dto.durationUnit,
          price: dto.price.toString(),
          discount: (dto.discount ?? 0).toString(),
          discountType: dto.discountType ?? 'amount',
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        })
        .returning();
      return row;
    } catch (err) {
      this.rethrow(err);
    }
  }

  async updateTerm(id: string, dto: UpdateSubTermDto) {
    const patch: Partial<SubscriptionTermRow> = {};
    if (dto.packageId !== undefined) patch.packageId = dto.packageId;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.durationValue !== undefined)
      patch.durationValue = dto.durationValue;
    if (dto.durationUnit !== undefined) patch.durationUnit = dto.durationUnit;
    if (dto.price !== undefined) patch.price = dto.price.toString();
    if (dto.discount !== undefined) patch.discount = dto.discount.toString();
    if (dto.discountType !== undefined) patch.discountType = dto.discountType;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;
    try {
      const rows = Object.keys(patch).length
        ? await this.db
            .update(subscriptionTerms)
            .set(patch)
            .where(eq(subscriptionTerms.id, id))
            .returning()
        : await this.db
            .select()
            .from(subscriptionTerms)
            .where(eq(subscriptionTerms.id, id));
      if (!rows.length) throw new NotFoundException('Term not found');
      return rows[0];
    } catch (err) {
      this.rethrow(err);
    }
  }

  async removeTerm(id: string) {
    const [row] = await this.db
      .select({ id: subscriptionTerms.id })
      .from(subscriptionTerms)
      .where(eq(subscriptionTerms.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Term not found');
    await this.db.delete(subscriptionTerms).where(eq(subscriptionTerms.id, id));
    return { id };
  }

  private rethrow(err: unknown): never {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? (err as { code?: string }).code
        : undefined;
    if (code === '23505') throw new ConflictException('Slug already in use');
    if (code === '23503')
      throw new BadRequestException('Parent does not exist');
    throw err;
  }
}
