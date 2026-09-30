import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  desc,
  eq,
  getTableColumns,
  gte,
  lte,
  sql,
  inArray,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import { FilesService } from '../files/files.service';
import type { DbClient } from '../db/drizzle.provider';
import { listingPhotos, listings } from '../db/schema/listings.schema';
import type {
  ListingPhotoRow,
  ListingRow,
  NewListing,
} from '../db/schema/listings.schema';
import { categories, subcategories } from '../db/schema/categories.schema';
import { communes, districts, provinces } from '../db/schema/users.schema';
import type { CreateListingDto } from './dto/create-listing.dto';
import type { UpdateListingDto } from './dto/update-listing.dto';
import type { QueryListingsDto } from './dto/query-listings.dto';
import type { PaginationMeta } from '../common/types/api-response.types';
import {
  cursorPredicate,
  decodeCursor,
  encodeCursor,
  orderByFor,
  sortKeyExpr,
} from './feed-cursor';
import { keywordCondition } from './keyword-search';

export interface ListingWithPhotos extends ListingRow {
  photos: ListingPhotoRow[];
}

export interface FeedFacet {
  slug: string;
  count: number;
}

export interface FeedMeta extends PaginationMeta {
  /** Present only with `includeFacets=true`. */
  facets?: { categories: FeedFacet[]; subcategories?: FeedFacet[] };
}

interface ResolvedFilters {
  categoryId?: string;
  subcategoryId?: string;
  /** Scope of the subcategory facet: the chosen category, else the chosen subcategory's parent. */
  facetCategoryId?: string;
  geo: SQL[];
}

@Injectable()
export class ListingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly filesService: FilesService,
  ) {}

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
      // Capture existing photo URLs so removed objects can be cleaned up
      // after the row swap (removeByPublicUrl warns on error, never throws).
      const existingPhotos = await this.db
        .select({ url: listingPhotos.url })
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, id));

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

      // Best-effort cleanup of photos dropped from the payload.
      const keptUrls = new Set(dto.photos.map((p) => p.url));
      await Promise.all(
        existingPhotos
          .filter((p) => !keptUrls.has(p.url))
          .map((p) => this.filesService.removeByPublicUrl(p.url)),
      );
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
  ): Promise<{ data: ListingWithPhotos[]; meta: FeedMeta }> {
    const limit = query.limit ?? 20;
    const sort = query.sort ?? 'newest';
    if (
      query.minPrice != null &&
      query.maxPrice != null &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice must not exceed maxPrice');
    }

    const resolved = await this.resolveFilterIds(query);
    if (resolved === null) {
      return {
        data: [],
        meta: {
          nextCursor: null,
          hasMore: false,
          limit,
          ...(query.includeTotal ? { total: 0 } : {}),
          ...(query.includeFacets ? { facets: { categories: [] } } : {}),
        },
      };
    }

    // `common` is everything EXCEPT the category dimension — the facet counts
    // are computed over it, so choosing a category never zeroes the others.
    const common: SQL[] = [
      eq(listings.status, 'active'),
      ...resolved.geo,
      ...this.feedConditions(query),
    ];
    const full = [...common, ...this.categoryConditions(resolved)];

    const cursor = decodeCursor(query.cursor, sort);
    const pageWhere = cursor ? [...full, cursorPredicate(cursor)] : full;

    const [rows, total, facets] = await Promise.all([
      this.db
        .select({ ...getTableColumns(listings), sortKey: sortKeyExpr(sort) })
        .from(listings)
        .where(and(...pageWhere))
        .orderBy(...orderByFor(sort))
        .limit(limit + 1),
      query.includeTotal ? this.countWhere(full) : undefined,
      query.includeFacets ? this.facetCounts(common, resolved) : undefined,
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ s: sort, v: last.sortKey, id: last.id })
        : null;

    // `sortKey` only feeds the cursor; strip it from the response rows.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = page.map(({ sortKey, ...l }) => l);
    const photosMap = await this.batchLoadPhotos(data.map((l) => l.id));
    const dataWithPhotos = data.map((l) => ({
      ...l,
      photos: photosMap.get(l.id) ?? [],
    }));

    return {
      data: dataWithPhotos,
      meta: {
        nextCursor,
        hasMore,
        limit,
        ...(total !== undefined ? { total } : {}),
        ...(facets ? { facets } : {}),
      },
    };
  }

  async findMine(
    userId: string,
    query: QueryListingsDto,
  ): Promise<{ data: ListingWithPhotos[]; meta: PaginationMeta }> {
    const limit = query.limit ?? 20;
    const conditions: SQL[] = [eq(listings.userId, userId)];

    if (query.status) {
      conditions.push(
        eq(listings.status, query.status as ListingRow['status']),
      );
    }
    const keyword = keywordCondition(query.q);
    if (keyword) conditions.push(keyword);

    const resolved = await this.resolveFilterIds(query);
    if (resolved === null)
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
    conditions.push(...resolved.geo, ...this.categoryConditions(resolved));

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

  /**
   * Resolves the slug filters to ids. Returns null when any given slug is
   * unknown — callers short-circuit to an empty result rather than erroring.
   * The category dimension is kept apart from the geo conditions because the
   * facet counts must be able to drop it.
   */
  private async resolveFilterIds(
    query: QueryListingsDto,
  ): Promise<ResolvedFilters | null> {
    const resolved: ResolvedFilters = { geo: [] };

    if (query.categorySlug) {
      const [cat] = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, query.categorySlug))
        .limit(1);
      if (!cat) return null;
      resolved.categoryId = cat.id;
      resolved.facetCategoryId = cat.id;
    }

    if (query.subcategorySlug) {
      const [sub] = await this.db
        .select({ id: subcategories.id, categoryId: subcategories.categoryId })
        .from(subcategories)
        .where(eq(subcategories.slug, query.subcategorySlug))
        .limit(1);
      if (!sub) return null;
      resolved.subcategoryId = sub.id;
      resolved.facetCategoryId ??= sub.categoryId;
    }

    if (query.provinceSlug) {
      const [prov] = await this.db
        .select({ id: provinces.id })
        .from(provinces)
        .where(eq(provinces.slug, query.provinceSlug))
        .limit(1);
      if (!prov) return null;
      resolved.geo.push(eq(listings.provinceId, prov.id));

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
        resolved.geo.push(eq(listings.districtId, dist.id));

        if (query.communeSlug) {
          const [com] = await this.db
            .select({ id: communes.id })
            .from(communes)
            .where(
              and(
                eq(communes.districtId, dist.id),
                eq(communes.slug, query.communeSlug),
              ),
            )
            .limit(1);
          if (!com) return null;
          resolved.geo.push(eq(listings.communeId, com.id));
        }
      }
    }

    return resolved;
  }

  private categoryConditions(resolved: ResolvedFilters): SQL[] {
    const out: SQL[] = [];
    if (resolved.categoryId)
      out.push(eq(listings.categoryId, resolved.categoryId));
    if (resolved.subcategoryId)
      out.push(eq(listings.subcategoryId, resolved.subcategoryId));
    return out;
  }

  /** The non-slug feed filters (keyword, price, condition, attributes, date, delivery). */
  private feedConditions(query: QueryListingsDto): SQL[] {
    const out: SQL[] = [];

    const keyword = keywordCondition(query.q);
    if (keyword) out.push(keyword);

    // Final (discounted) price — what the cards show. A null price is
    // "Negotiable" and drops out of any bounded range (null >= x is null).
    if (query.minPrice != null) {
      out.push(gte(listings.effectivePrice, String(query.minPrice)));
    }
    if (query.maxPrice != null) {
      out.push(lte(listings.effectivePrice, String(query.maxPrice)));
    }
    if (query.condition) {
      out.push(eq(listings.condition, query.condition));
    }
    // Attribute filters match the display names stored in `attributes` JSONB
    // (e.g. `attributes.brand = 'Toyota'`), which is what the post form writes.
    if (query.brand) {
      out.push(eq(sql`${listings.attributes}->>'brand'`, query.brand));
    }
    if (query.bodyType) {
      out.push(eq(sql`${listings.attributes}->>'bodyType'`, query.bodyType));
    }
    // Generic attribute filter for every grid that is NOT a car's Body Type.
    // The key is bound as a parameter (`->>$n`), never interpolated, and the
    // DTO additionally constrains it to a plain identifier — so this stays a
    // read of the JSONB, not a path injection. Half a filter (one param
    // without the other) applies nothing rather than erroring, matching how
    // `districtSlug` without `provinceSlug` is already treated.
    if (query.attrKey && query.attrValue) {
      out.push(
        eq(sql`${listings.attributes}->>${query.attrKey}`, query.attrValue),
      );
    }

    // `published_at`, not `created_at`: a draft can sit for days before it
    // goes live, and "posted today" means went live today.
    if (query.postedWithin === 'today') {
      out.push(
        sql`${listings.publishedAt} >= (date_trunc('day', now() AT TIME ZONE 'Asia/Phnom_Penh') AT TIME ZONE 'Asia/Phnom_Penh')`,
      );
    } else if (query.postedWithin === 'week') {
      out.push(sql`${listings.publishedAt} >= now() - interval '7 days'`);
    } else if (query.postedWithin === 'month') {
      out.push(sql`${listings.publishedAt} >= now() - interval '30 days'`);
    }

    if (query.deliveryFree) {
      out.push(eq(listings.deliveryFree, true));
    }
    return out;
  }

  private async countWhere(conditions: SQL[]): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  /**
   * Per-category counts over `common` (every filter except the category
   * dimension), plus per-subcategory counts inside the selected category.
   * Zero-count rows are simply absent (GROUP BY). Ordered by the catalogue's
   * own sort_order so the list does not reshuffle as the counts change.
   */
  private async facetCounts(
    common: SQL[],
    resolved: ResolvedFilters,
  ): Promise<NonNullable<FeedMeta['facets']>> {
    const count = sql<number>`count(*)::int`;
    const [cats, subs] = await Promise.all([
      this.db
        .select({ slug: categories.slug, count })
        .from(listings)
        .innerJoin(categories, eq(listings.categoryId, categories.id))
        .where(and(...common))
        .groupBy(categories.id)
        .orderBy(categories.sortOrder, categories.slug),
      resolved.facetCategoryId
        ? this.db
            .select({ slug: subcategories.slug, count })
            .from(listings)
            .innerJoin(
              subcategories,
              eq(listings.subcategoryId, subcategories.id),
            )
            .where(
              and(...common, eq(listings.categoryId, resolved.facetCategoryId)),
            )
            .groupBy(subcategories.id)
            .orderBy(subcategories.sortOrder, subcategories.slug)
        : undefined,
    ]);
    return subs
      ? { categories: cats, subcategories: subs }
      : { categories: cats };
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
