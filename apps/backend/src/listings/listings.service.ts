import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  desc,
  eq,
  lt,
  or,
  ilike,
  gte,
  lte,
  sql,
  inArray,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { listingPhotos, listings } from '../db/schema/listings.schema';
import type {
  ListingPhotoRow,
  ListingRow,
  NewListing,
} from '../db/schema/listings.schema';
import { categories, subcategories } from '../db/schema/categories.schema';
import { districts, provinces } from '../db/schema/users.schema';
import type { CreateListingDto } from './dto/create-listing.dto';
import type { UpdateListingDto } from './dto/update-listing.dto';
import type { QueryListingsDto } from './dto/query-listings.dto';
import type { PaginationMeta } from '../common/types/api-response.types';

export interface ListingWithPhotos extends ListingRow {
  photos: ListingPhotoRow[];
}

@Injectable()
export class ListingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  async create(
    userId: string,
    dto: CreateListingDto,
  ): Promise<ListingWithPhotos> {
    const [cat] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, dto.categoryId))
      .limit(1);
    if (!cat) throw new NotFoundException('Category not found');

    const [sub] = await this.db
      .select({ id: subcategories.id })
      .from(subcategories)
      .where(
        and(
          eq(subcategories.id, dto.subcategoryId),
          eq(subcategories.categoryId, dto.categoryId),
        ),
      )
      .limit(1);
    if (!sub) throw new NotFoundException('Subcategory not found');

    const values: NewListing = {
      userId,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      title: dto.title,
      description: dto.description ?? null,
      price: dto.price != null ? String(dto.price) : null,
      currency: 'USD',
      discountValue:
        dto.discountValue != null ? String(dto.discountValue) : null,
      discountType: dto.discountType ?? null,
      condition: dto.condition ?? null,
      attributes: dto.attributes ?? {},
      location: dto.location ?? null,
      address: dto.address ?? null,
      latitude: dto.latitude != null ? String(dto.latitude) : null,
      longitude: dto.longitude != null ? String(dto.longitude) : null,
      provinceId: dto.provinceId ?? null,
      districtId: dto.districtId ?? null,
      communeId: dto.communeId ?? null,
      deliveryFree: dto.deliveryFree ?? false,
      contactName: dto.contactName ?? null,
      contactPhones: dto.contactPhones ?? [],
      contactEmail: dto.contactEmail ?? null,
      status: 'draft',
    };

    const [listing] = await this.db.insert(listings).values(values).returning();

    const photos: ListingPhotoRow[] = [];
    if (dto.photos && dto.photos.length > 0) {
      const rows = await this.db
        .insert(listingPhotos)
        .values(
          dto.photos.map((p) => ({
            listingId: listing.id,
            url: p.url,
            path: p.path,
            sort: p.sort,
          })),
        )
        .returning();
      photos.push(...rows);
    }

    return { ...listing, photos };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateListingDto,
  ): Promise<ListingWithPhotos> {
    const existing = await this.findById(id);
    if (existing.userId !== userId)
      throw new ForbiddenException('Not the listing owner');

    const updates: Partial<ListingRow> = { updatedAt: new Date() };
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.price !== undefined)
      updates.price = dto.price != null ? String(dto.price) : null;
    if (dto.discountValue !== undefined)
      updates.discountValue =
        dto.discountValue != null ? String(dto.discountValue) : null;
    if (dto.discountType !== undefined)
      updates.discountType = dto.discountType ?? null;
    if (dto.condition !== undefined) updates.condition = dto.condition ?? null;
    if (dto.attributes !== undefined) updates.attributes = dto.attributes;
    if (dto.location !== undefined) updates.location = dto.location;
    if (dto.address !== undefined) updates.address = dto.address;
    if (dto.latitude !== undefined)
      updates.latitude = dto.latitude != null ? String(dto.latitude) : null;
    if (dto.longitude !== undefined)
      updates.longitude = dto.longitude != null ? String(dto.longitude) : null;
    if (dto.provinceId !== undefined) updates.provinceId = dto.provinceId;
    if (dto.districtId !== undefined) updates.districtId = dto.districtId;
    if (dto.communeId !== undefined) updates.communeId = dto.communeId;
    if (dto.deliveryFree !== undefined) updates.deliveryFree = dto.deliveryFree;
    if (dto.contactName !== undefined) updates.contactName = dto.contactName;
    if (dto.contactPhones !== undefined)
      updates.contactPhones = dto.contactPhones;
    if (dto.contactEmail !== undefined) updates.contactEmail = dto.contactEmail;

    const [updated] = await this.db
      .update(listings)
      .set(updates)
      .where(eq(listings.id, id))
      .returning();

    let photos: ListingPhotoRow[];
    if (dto.photos !== undefined) {
      await this.db
        .delete(listingPhotos)
        .where(eq(listingPhotos.listingId, id));
      if (dto.photos.length > 0) {
        photos = await this.db
          .insert(listingPhotos)
          .values(
            dto.photos.map((p) => ({
              listingId: id,
              url: p.url,
              path: p.path,
              sort: p.sort,
            })),
          )
          .returning();
      } else {
        photos = [];
      }
    } else {
      photos = await this.db
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, id))
        .orderBy(listingPhotos.sort);
    }

    return { ...updated, photos };
  }

  async findById(id: string): Promise<ListingWithPhotos> {
    const [listing] = await this.db
      .select()
      .from(listings)
      .where(eq(listings.id, id))
      .limit(1);
    if (!listing) throw new NotFoundException('Listing not found');

    const photos = await this.db
      .select()
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, listing.id))
      .orderBy(listingPhotos.sort);

    return { ...listing, photos };
  }

  async findFeed(
    query: QueryListingsDto,
  ): Promise<{ data: ListingWithPhotos[]; meta: PaginationMeta }> {
    const limit = query.limit ?? 20;
    const conditions = [eq(listings.status, 'active')];

    const extra = await this.resolveQueryFilters(query);
    if (extra === null)
      return { data: [], meta: { nextCursor: null, hasMore: false, limit } };
    conditions.push(...extra);

    if (query.q) {
      conditions.push(ilike(listings.title, `%${query.q}%`));
    }
    if (query.minPrice != null) {
      conditions.push(gte(listings.price, String(query.minPrice)));
    }
    if (query.maxPrice != null) {
      conditions.push(lte(listings.price, String(query.maxPrice)));
    }
    if (query.condition) {
      conditions.push(eq(listings.condition, query.condition));
    }

    if (query.cursor) {
      try {
        const { createdAt, id } = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf8'),
        ) as { createdAt: string; id: string };
        conditions.push(
          or(
            lt(listings.createdAt, new Date(createdAt)),
            and(
              eq(listings.createdAt, new Date(createdAt)),
              lt(listings.id, id),
            ),
          )!,
        );
      } catch {
        // ignore invalid cursor
      }
    }

    const rows = await this.db
      .select()
      .from(listings)
      .where(and(...conditions))
      .orderBy(desc(listings.createdAt), desc(listings.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({ createdAt: last.createdAt, id: last.id }),
          ).toString('base64')
        : null;

    const photosMap = await this.batchLoadPhotos(data.map((l) => l.id));
    const dataWithPhotos = data.map((l) => ({
      ...l,
      photos: photosMap.get(l.id) ?? [],
    }));

    return { data: dataWithPhotos, meta: { nextCursor, hasMore, limit } };
  }

  async findMine(
    userId: string,
    query: QueryListingsDto,
  ): Promise<{ data: ListingWithPhotos[]; meta: PaginationMeta }> {
    const limit = query.limit ?? 20;
    const conditions = [eq(listings.userId, userId)];

    if (query.status) {
      conditions.push(
        eq(listings.status, query.status as ListingRow['status']),
      );
    }
    if (query.q) {
      conditions.push(ilike(listings.title, `%${query.q}%`));
    }

    const extra = await this.resolveQueryFilters(query);
    if (extra === null)
      return {
        data: [],
        meta: {
          nextCursor: null,
          hasMore: false,
          limit,
          total: 0,
          page: query.page,
          pageSize: query.pageSize,
        },
      };
    conditions.push(...extra);

    const offset =
      query.page && query.pageSize ? (query.page - 1) * query.pageSize : 0;

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(listings)
      .where(and(...conditions))
      .orderBy(desc(listings.createdAt))
      .limit(limit)
      .offset(offset);

    const photosMap = await this.batchLoadPhotos(rows.map((l) => l.id));
    const dataWithPhotos = rows.map((l) => ({
      ...l,
      photos: photosMap.get(l.id) ?? [],
    }));

    return {
      data: dataWithPhotos,
      meta: {
        nextCursor: null,
        hasMore: offset + rows.length < (countRow?.count ?? 0),
        limit,
        total: countRow?.count ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      },
    };
  }

  async publish(userId: string, id: string): Promise<ListingWithPhotos> {
    const existing = await this.findById(id);
    if (existing.userId !== userId)
      throw new ForbiddenException('Not the listing owner');

    const publishedAt = new Date();
    const expiresAt = new Date(
      publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    const [updated] = await this.db
      .update(listings)
      .set({ status: 'active', publishedAt, expiresAt, updatedAt: new Date() })
      .where(eq(listings.id, id))
      .returning();

    const photos = await this.db
      .select()
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, id))
      .orderBy(listingPhotos.sort);

    return { ...updated, photos };
  }

  private async resolveQueryFilters(
    query: QueryListingsDto,
  ): Promise<SQL[] | null> {
    const extra: SQL[] = [];

    if (query.categorySlug) {
      const [cat] = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, query.categorySlug))
        .limit(1);
      if (!cat) return null;
      extra.push(eq(listings.categoryId, cat.id));
    }

    if (query.subcategorySlug) {
      const [sub] = await this.db
        .select({ id: subcategories.id })
        .from(subcategories)
        .where(eq(subcategories.slug, query.subcategorySlug))
        .limit(1);
      if (!sub) return null;
      extra.push(eq(listings.subcategoryId, sub.id));
    }

    if (query.provinceSlug) {
      const [prov] = await this.db
        .select({ id: provinces.id })
        .from(provinces)
        .where(eq(provinces.slug, query.provinceSlug))
        .limit(1);
      if (!prov) return null;
      extra.push(eq(listings.provinceId, prov.id));

      if (query.districtSlug) {
        const [dist] = await this.db
          .select({ id: districts.id })
          .from(districts)
          .where(
            and(
              eq(districts.provinceId, prov.id),
              eq(districts.slug, query.districtSlug),
            ),
          )
          .limit(1);
        if (!dist) return null;
        extra.push(eq(listings.districtId, dist.id));
      }
    }

    return extra;
  }

  private async batchLoadPhotos(
    listingIds: string[],
  ): Promise<Map<string, ListingPhotoRow[]>> {
    if (listingIds.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(listingPhotos)
      .where(inArray(listingPhotos.listingId, listingIds))
      .orderBy(listingPhotos.sort);
    const map = new Map<string, ListingPhotoRow[]>();
    for (const row of rows) {
      const arr = map.get(row.listingId);
      if (arr) {
        arr.push(row);
      } else {
        map.set(row.listingId, [row]);
      }
    }
    return map;
  }

  async remove(userId: string, id: string): Promise<ListingWithPhotos> {
    const existing = await this.findById(id);
    if (existing.userId !== userId)
      throw new ForbiddenException('Not the listing owner');

    const [updated] = await this.db
      .update(listings)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(listings.id, id))
      .returning();

    const photos = await this.db
      .select()
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, id))
      .orderBy(listingPhotos.sort);

    return { ...updated, photos };
  }
}
