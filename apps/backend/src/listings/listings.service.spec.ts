import { PgDialect } from 'drizzle-orm/pg-core';
import { ListingsService } from './listings.service';

function makeDb() {
  return {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeService(db: ReturnType<typeof makeDb>) {
  const filesService = {
    removeByPublicUrl: jest.fn().mockResolvedValue(undefined),
  };
  const reactionsService = {
    countLikes: jest.fn().mockResolvedValue(0),
  };
  return new ListingsService(
    db as never,
    filesService as never,
    reactionsService as never,
    {} as never,
  );
}

// Builds a mock chain that terminates with .limit() → resolves to `result`.
function slugLookup(result: object[]) {
  return {
    from: () => ({
      where: () => ({ limit: () => Promise.resolve(result) }),
    }),
  };
}

// Builds a mock chain for the main listings query. The feed joins `users` for
// the seller's handle, so the real chain is `.from().leftJoin().where()…`;
// `where` stays reachable so the helper still describes a chain without one.
function listingsQuery(result: object[]) {
  const tail = {
    where: () => ({
      orderBy: () => ({ limit: () => Promise.resolve(result) }),
    }),
  };
  return { from: () => ({ ...tail, leftJoin: () => tail }) };
}

describe('ListingsService.findFeed filters', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ListingsService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  it('returns empty data when categorySlug is not found', async () => {
    db.select.mockReturnValue(slugLookup([]));

    const result = await service.findFeed({ categorySlug: 'nonexistent' });

    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
    // Only one select call made (the slug lookup) — no listings query
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('proceeds to listings query when categorySlug resolves', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return slugLookup([{ id: 'cat-1' }]);
      return listingsQuery([]);
    });

    const result = await service.findFeed({ categorySlug: 'cars' });

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual([]);
  });

  it('returns empty data when subcategorySlug is not found', async () => {
    db.select.mockReturnValue(slugLookup([]));

    const result = await service.findFeed({ subcategorySlug: 'nonexistent' });

    expect(result.data).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('proceeds when subcategorySlug resolves', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return slugLookup([{ id: 'sub-1' }]);
      return listingsQuery([]);
    });

    const result = await service.findFeed({ subcategorySlug: 'sedan' });

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual([]);
  });

  it('returns empty data when provinceSlug is not found', async () => {
    db.select.mockReturnValue(slugLookup([]));

    const result = await service.findFeed({ provinceSlug: 'nonexistent' });

    expect(result.data).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('proceeds when provinceSlug resolves', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return slugLookup([{ id: 'prov-1' }]);
      return listingsQuery([]);
    });

    const result = await service.findFeed({ provinceSlug: 'phnom-penh' });

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual([]);
  });

  it('returns empty data when districtSlug is not found within province', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return slugLookup([{ id: 'prov-1' }]); // province found
      return slugLookup([]); // district not found
    });

    const result = await service.findFeed({
      provinceSlug: 'phnom-penh',
      districtSlug: 'nonexistent',
    });

    expect(result.data).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('proceeds when both provinceSlug and districtSlug resolve', async () => {
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return slugLookup([{ id: 'prov-1' }]);
      if (callCount === 2) return slugLookup([{ id: 'dist-1' }]);
      return listingsQuery([]);
    });

    const result = await service.findFeed({
      provinceSlug: 'phnom-penh',
      districtSlug: 'chamkar-mon',
    });

    expect(db.select).toHaveBeenCalledTimes(3);
    expect(result.data).toEqual([]);
  });

  it('ignores districtSlug when provinceSlug is absent', async () => {
    db.select.mockReturnValue(listingsQuery([]));

    const result = await service.findFeed({ districtSlug: 'chamkar-mon' });

    // No province/district lookup — goes straight to listings query
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual([]);
  });

  it('returns empty array and empty meta when no filters are set', async () => {
    db.select.mockReturnValue(listingsQuery([]));

    const result = await service.findFeed({});

    expect(result.data).toEqual([]);
    expect(result.meta.hasMore).toBe(false);
  });

  /**
   * The attribute filters are the one part of this method whose *SQL* matters,
   * not just its call count — `attrKey` is a JSONB path segment, so a test that
   * only counted calls would pass while the key was being interpolated straight
   * into the statement. These compile the WHERE clause and assert on it.
   */
  describe('attribute filters', () => {
    /** Captures the WHERE clause so the generated SQL can be inspected. */
    function captureListingsQuery(capture: { where?: unknown }) {
      return {
        from: () => {
          // The feed joins `users` for the seller's handle before its WHERE.
          const tail = {
            where: (w: unknown) => {
              capture.where = w;
              return { orderBy: () => ({ limit: () => Promise.resolve([]) }) };
            },
          };
          return { ...tail, leftJoin: () => tail };
        },
      };
    }

    async function whereSqlFor(query: Parameters<typeof service.findFeed>[0]) {
      const capture: { where?: unknown } = {};
      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return slugLookup([{ id: 'sub-1' }]);
        return captureListingsQuery(capture);
      });

      await service.findFeed({ subcategorySlug: 'house-for-sale', ...query });

      return new PgDialect().sqlToQuery(capture.where as never);
    }

    it('binds attrKey as a parameter instead of interpolating it', async () => {
      const { sql: text, params } = await whereSqlFor({
        attrKey: 'type',
        attrValue: 'Flat',
      });

      // `->>$n`, never `->>'type'` — the key is a bound param.
      expect(text).toContain('->>');
      expect(text).not.toContain('type');
      expect(text).not.toContain('Flat');
      expect(params).toContain('type');
      expect(params).toContain('Flat');
    });

    it('filters on an arbitrary key, not just bodyType', async () => {
      const { params } = await whereSqlFor({
        attrKey: 'vehicleType',
        attrValue: 'City Bus',
      });

      expect(params).toContain('vehicleType');
      expect(params).toContain('City Bus');
    });

    it('applies no attribute filter when only attrKey is sent', async () => {
      const { params } = await whereSqlFor({ attrKey: 'type' });

      expect(params).not.toContain('type');
    });

    it('applies no attribute filter when only attrValue is sent', async () => {
      const { params } = await whereSqlFor({ attrValue: 'Flat' });

      expect(params).not.toContain('Flat');
    });

    it('leaves the existing brand and bodyType filters intact', async () => {
      const { sql: text, params } = await whereSqlFor({
        brand: 'Toyota',
        bodyType: 'Sedan',
      });

      // The pre-existing filters still inline their hardcoded keys — they are
      // literals in the query, not caller-supplied path segments.
      expect(text).toContain("->>'brand'");
      expect(text).toContain("->>'bodyType'");
      expect(params).toContain('Toyota');
      expect(params).toContain('Sedan');
    });
  });

  /**
   * The seller scope backs the public profile's post history, so what is worth
   * asserting is not that the filter ran but that it cannot *widen* the feed:
   * `status = 'active'` stays unconditional and the id is a bound parameter.
   */
  describe('seller scope (userId)', () => {
    const SELLER_ID = '3f2a1c4e-5b6d-4e8f-9a0b-1c2d3e4f5a6b';

    function captureWhere(capture: { where?: unknown }) {
      return {
        from: () => {
          // The feed joins `users` for the seller's handle before its WHERE.
          const tail = {
            where: (w: unknown) => {
              capture.where = w;
              return { orderBy: () => ({ limit: () => Promise.resolve([]) }) };
            },
          };
          return { ...tail, leftJoin: () => tail };
        },
      };
    }

    async function whereSqlFor(query: { userId?: string }) {
      const capture: { where?: unknown } = {};
      db.select.mockImplementation(() => captureWhere(capture));

      await service.findFeed(query);

      return new PgDialect().sqlToQuery(capture.where as never);
    }

    it('narrows the feed to that seller', async () => {
      const { sql: text, params } = await whereSqlFor({ userId: SELLER_ID });

      expect(text).toContain('user_id');
      // Bound as a parameter, never spliced into the statement.
      expect(text).not.toContain(SELLER_ID);
      expect(params).toContain(SELLER_ID);
    });

    it('keeps the active-only guard, so a profile can never reveal a draft', async () => {
      const { sql: text, params } = await whereSqlFor({ userId: SELLER_ID });

      expect(text).toContain('"status"');
      expect(params).toContain('active');
    });

    it('applies no seller filter when userId is absent', async () => {
      const { sql: text } = await whereSqlFor({});

      expect(text).not.toContain('user_id');
    });
  });
});

/**
 * `findById` carries the owner's real handle, which is what the detail page's
 * seller card links to. It used to be derived from the listing's free-text
 * `contactName`, which is unrelated to the account — every seller link pointed
 * at a profile that did not exist.
 */
describe('ListingsService.findById seller handle', () => {
  let db: ReturnType<typeof makeDb>;
  let service: ListingsService;

  /** .select().from().leftJoin().where().limit() — the joined listing query. */
  const listingQuery = (result: object[]) => ({
    from: () => ({
      leftJoin: () => ({
        where: () => ({ limit: () => Promise.resolve(result) }),
      }),
    }),
  });
  /** .select().from().where().orderBy() — the photos query that follows it. */
  const photosQuery = () => ({
    from: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }),
  });

  function mockListing(row: object | undefined) {
    let call = 0;
    db.select.mockImplementation(() => {
      call++;
      return call === 1 ? listingQuery(row ? [row] : []) : photosQuery();
    });
  }

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  it('carries the joined owner handle', async () => {
    mockListing({
      listing: { id: 'listing-1', userId: 'user-1', title: 'Luk kmeng khoch' },
      sellerUsername: 'qwer',
    });

    const result = await service.findById('listing-1');

    expect(result.sellerUsername).toBe('qwer');
    expect(result.id).toBe('listing-1');
    expect(result.photos).toEqual([]);
  });

  it('reports a gone owner as null rather than dropping the key', async () => {
    mockListing({
      listing: { id: 'listing-2', userId: 'user-2' },
      sellerUsername: null,
    });

    // A left join, so a soft-deleted owner still yields their listing.
    await expect(service.findById('listing-2')).resolves.toMatchObject({
      id: 'listing-2',
      sellerUsername: null,
    });
  });

  it('throws when the listing does not exist', async () => {
    mockListing(undefined);

    await expect(service.findById('nope')).rejects.toThrow('Listing not found');
  });
});

/**
 * Search/filter additions (spec-search.md). A generic chainable mock: every
 * builder method records its arguments and returns the chain, and awaiting
 * the chain yields the queued rows — so one helper covers slug lookups, the
 * page query, the count and both facet GROUP BYs.
 */
describe('ListingsService.findFeed search + facets', () => {
  type Rec = Record<string, unknown[]>;
  const dialect = new PgDialect();
  const compile = (s: unknown) => dialect.sqlToQuery(s as never);

  let db: ReturnType<typeof makeDb>;
  let service: ListingsService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  function chain(result: unknown[], rec: Rec) {
    const c: Record<string, unknown> = {};
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'leftJoin',
      'innerJoin',
      'groupBy',
    ]) {
      c[m] = (...args: unknown[]) => {
        rec[m] = args;
        return c;
      };
    }
    c.then = (
      resolve: (v: unknown[]) => unknown,
      reject: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    return c;
  }

  /** Queues one result per db.select() call; returns each call's record. */
  function queue(...results: unknown[][]): Rec[] {
    // Pre-allocated so callers can destructure before the calls happen.
    const recs: Rec[] = results.map(() => ({}));
    let i = 0;
    db.select.mockImplementation(() => {
      const rec: Rec = recs[i] ?? {};
      if (i >= recs.length) recs.push(rec);
      return chain(results[i++] ?? [], rec);
    });
    return recs;
  }

  const whereOf = (rec: Rec) => compile(rec.where[0]);

  it('rejects an inverted price range', async () => {
    await expect(
      service.findFeed({ minPrice: 500, maxPrice: 100 }),
    ).rejects.toThrow('minPrice must not exceed maxPrice');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('filters price on the final (discounted) price', async () => {
    const [page] = queue([]);
    await service.findFeed({ minPrice: 100, maxPrice: 500 });
    const { sql, params } = whereOf(page);
    expect(sql).toMatch(/"effective_price" >= \$\d+/);
    expect(sql).toMatch(/"effective_price" <= \$\d+/);
    expect(sql).not.toMatch(/"price" >=/);
    expect(params).toEqual(expect.arrayContaining(['100', '500']));
  });

  it('matches the keyword in title and description', async () => {
    const [page] = queue([]);
    await service.findFeed({ q: 'prius' });
    const { sql, params } = whereOf(page);
    expect(sql).toMatch(/"title" ilike/);
    expect(sql).toMatch(/"description" ilike/);
    expect(params).toContain('%prius%');
  });

  it('postedWithin=today counts from midnight Phnom Penh on the go-live time', async () => {
    const [page] = queue([]);
    await service.findFeed({ postedWithin: 'today' });
    const { sql } = whereOf(page);
    // published_at, falling back to created_at for rows never published
    // through the API (seeded rows) — otherwise they could never match.
    expect(sql).toMatch(
      /coalesce\("listings"\."published_at", "listings"\."created_at"\) >=/,
    );
    expect(sql).toContain("'Asia/Phnom_Penh'");
  });

  it('only shows live listings: active and not past expires_at', async () => {
    const [page] = queue([]);
    await service.findFeed({});
    const { sql } = whereOf(page);
    expect(sql).toContain('"status" = $');
    expect(sql).toMatch(
      /\("listings"\."expires_at" is null or "listings"\."expires_at" > now\(\)\)/,
    );
  });

  it('filters model year numerically and engine type by name', async () => {
    const [page] = queue([]);
    await service.findFeed({
      yearMin: 2018,
      yearMax: 2022,
      engineType: 'Petrol',
    });
    const { sql, params } = whereOf(page);
    expect(sql).toContain("~ '^[0-9]{4}$'");
    expect(sql).toMatch(/::int END\) >= \$\d+/);
    expect(sql).toMatch(/::int END\) <= \$\d+/);
    expect(sql).toContain("->>'engineType'");
    expect(params).toEqual(expect.arrayContaining([2018, 2022, 'Petrol']));
  });

  it('rejects an inverted year range', async () => {
    await expect(
      service.findFeed({ yearMin: 2022, yearMax: 2018 }),
    ).rejects.toThrow('yearMin must not exceed yearMax');
  });

  describe('best match + typo fallback', () => {
    const hit = { id: 'a', sortKey: '1.5' };

    it('orders by the relevance score for sort=relevance', async () => {
      const [page] = queue([hit]);
      await service.findFeed({ q: 'toyota', sort: 'relevance' });
      const first = compile(page.orderBy[0]).sql;
      expect(first).toContain('word_similarity');
      expect(first).toMatch(/::float8 desc$/);
    });

    it('falls back to newest when relevance has no keyword', async () => {
      const [page] = queue([]);
      await service.findFeed({ sort: 'relevance' });
      expect(compile(page.orderBy[0]).sql).toMatch(/created_at" desc/);
    });

    it('does not fuzz while the exact search has results', async () => {
      const [page] = queue([hit]);
      const res = await service.findFeed({ q: 'toyota' });
      // The page query + the photo batch for its row — no second page query.
      expect(db.select).toHaveBeenCalledTimes(2);
      expect(whereOf(page).sql).not.toContain('word_similarity');
      expect(res.meta).not.toHaveProperty('fuzzy');
    });

    it('retries with typo tolerance when nothing matches exactly', async () => {
      const [exact, fuzzy] = queue([], [hit, { id: 'b', sortKey: '1' }]);
      const res = await service.findFeed({ q: 'toyta', limit: 1 });
      expect(whereOf(exact).sql).not.toContain('word_similarity');
      expect(whereOf(fuzzy).sql).toContain('word_similarity');
      expect(res.meta.fuzzy).toBe(true);
      const cursor = JSON.parse(
        Buffer.from(res.meta.nextCursor!, 'base64').toString('utf8'),
      ) as { f?: boolean };
      expect(cursor.f).toBe(true);
    });

    it('keeps a fuzzy cursor fuzzy on later pages, without re-deciding', async () => {
      const [page] = queue([]);
      const cursor = Buffer.from(
        JSON.stringify({ s: 'newest', v: '2026-09-30', id: 'a', f: true }),
      ).toString('base64');
      const res = await service.findFeed({ q: 'toyta', cursor });
      expect(whereOf(page).sql).toContain('word_similarity');
      expect(db.select).toHaveBeenCalledTimes(1);
      expect(res.meta.fuzzy).toBe(true);
    });

    it('never fuzzes a later exact page that runs dry', async () => {
      queue([]);
      const cursor = Buffer.from(
        JSON.stringify({ s: 'newest', v: '2026-09-30', id: 'a' }),
      ).toString('base64');
      await service.findFeed({ q: 'toyota', cursor });
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('does not fuzz tokens shorter than 4 characters', async () => {
      queue([]);
      await service.findFeed({ q: 'bmw' });
      expect(db.select).toHaveBeenCalledTimes(1);
    });
  });

  it('deliveryFree=true filters on delivery_free', async () => {
    const [page] = queue([]);
    await service.findFeed({ deliveryFree: true });
    expect(whereOf(page).sql).toContain('"delivery_free" = $');
  });

  describe('commune', () => {
    it('resolves inside the district', async () => {
      const recs = queue(
        [{ id: 'prov-1' }],
        [{ id: 'dist-1' }],
        [{ id: 'com-1' }],
        [],
      );
      await service.findFeed({
        provinceSlug: 'phnom-penh',
        districtSlug: 'chamkar-mon',
        communeSlug: 'tonle-basak',
      });
      expect(recs).toHaveLength(4);
      expect(whereOf(recs[2]).params).toEqual(
        expect.arrayContaining(['dist-1', 'tonle-basak']),
      );
      expect(whereOf(recs[3]).params).toContain('com-1');
    });

    it('short-circuits on an unknown commune', async () => {
      queue([{ id: 'prov-1' }], [{ id: 'dist-1' }], []);
      const res = await service.findFeed({
        provinceSlug: 'phnom-penh',
        districtSlug: 'chamkar-mon',
        communeSlug: 'nope',
      });
      expect(res.data).toEqual([]);
      expect(db.select).toHaveBeenCalledTimes(3);
    });

    it('is ignored without a district', async () => {
      queue([{ id: 'prov-1' }], []);
      await service.findFeed({ provinceSlug: 'phnom-penh', communeSlug: 'x' });
      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('sort + cursor', () => {
    const row = (id: string, sortKey: string | null) => ({ id, sortKey });

    it('orders price_asc with nulls last', async () => {
      const [page] = queue([]);
      await service.findFeed({ sort: 'price_asc' });
      const first = compile(page.orderBy[0]).sql;
      expect(first).toMatch(/effective_price" asc nulls last/);
    });

    it('issues a cursor for its own sort and strips sortKey from rows', async () => {
      queue([row('a', '10.00'), row('b', '20.00'), row('c', '30.00')]);
      const res = await service.findFeed({ sort: 'price_asc', limit: 2 });
      expect(res.data.map((l) => l.id)).toEqual(['a', 'b']);
      expect(res.data[0]).not.toHaveProperty('sortKey');
      const cursor = JSON.parse(
        Buffer.from(res.meta.nextCursor!, 'base64').toString('utf8'),
      ) as unknown;
      expect(cursor).toEqual({ s: 'price_asc', v: '20.00', id: 'b' });
    });

    it('applies a matching cursor', async () => {
      const [page] = queue([]);
      const cursor = Buffer.from(
        JSON.stringify({ s: 'price_desc', v: '20.00', id: 'b' }),
      ).toString('base64');
      await service.findFeed({ sort: 'price_desc', cursor });
      expect(whereOf(page).params).toEqual(
        expect.arrayContaining(['20.00', 'b']),
      );
    });

    it('ignores a cursor issued for another sort', async () => {
      const [page] = queue([]);
      const cursor = Buffer.from(
        JSON.stringify({ s: 'price_asc', v: '20.00', id: 'b' }),
      ).toString('base64');
      await service.findFeed({ sort: 'price_desc', cursor });
      expect(whereOf(page).params).not.toContain('20.00');
    });
  });

  describe('total + facets', () => {
    it('omits total and facets unless asked', async () => {
      queue([]);
      const res = await service.findFeed({ q: 'x' });
      expect(res.meta).not.toHaveProperty('total');
      expect(res.meta).not.toHaveProperty('facets');
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('returns total over the full filter set', async () => {
      const [, count] = queue([], [{ count: 7 }]);
      const res = await service.findFeed({ q: 'x', includeTotal: true });
      expect(res.meta.total).toBe(7);
      expect(whereOf(count).params).toContain('%x%');
    });

    it('category facets drop the category dimension but keep the rest', async () => {
      const cats = [{ slug: 'cars-and-vehicles', count: 3 }];
      const subs = [{ slug: 'cars-for-sale', count: 3 }];
      // One page row, so the empty-result typo retry does not kick in.
      const recs = queue([{ id: 'cat-1' }], [{ id: 'x' }], cats, subs);
      const res = await service.findFeed({
        categorySlug: 'cars-and-vehicles',
        q: 'toyota',
        includeFacets: true,
      });

      expect(whereOf(recs[1]).sql).toContain('"category_id" = $');

      const catFacet = whereOf(recs[2]);
      expect(catFacet.sql).not.toContain('"category_id" = $');
      expect(catFacet.params).toContain('%toyota%');

      const subFacet = whereOf(recs[3]);
      expect(subFacet.sql).toContain('"category_id" = $');
      expect(subFacet.sql).not.toContain('"subcategory_id" = $');

      expect(res.meta.facets).toEqual({
        categories: cats,
        subcategories: subs,
      });
    });

    it('scopes the subcategory facet to the parent of a lone subcategory', async () => {
      const recs = queue([{ id: 'sub-1', categoryId: 'cat-9' }], [], [], []);
      await service.findFeed({
        subcategorySlug: 'cars-for-sale',
        includeFacets: true,
      });
      const subFacet = whereOf(recs[3]);
      expect(subFacet.params).toContain('cat-9');
      expect(subFacet.sql).not.toContain('"subcategory_id" = $');
    });

    it('has no subcategory facet without a category', async () => {
      queue([], []);
      const res = await service.findFeed({ includeFacets: true });
      expect(res.meta.facets).toEqual({ categories: [] });
      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('an unknown category short-circuits to zero with empty facets', async () => {
      queue([]);
      const res = await service.findFeed({
        categorySlug: 'nope',
        includeTotal: true,
        includeFacets: true,
      });
      expect(res.meta.total).toBe(0);
      expect(res.meta.facets).toEqual({ categories: [] });
      expect(db.select).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ListingsService plan enforcement', () => {
  function setup(existing: Record<string, unknown>) {
    const returning = jest.fn().mockResolvedValue([{ id: 'l1' }]);
    const set = jest.fn(() => ({ where: () => ({ returning }) }));
    const db = { ...makeDb(), update: jest.fn(() => ({ set })) };
    const entitlements = {
      assertPhotos: jest.fn().mockResolvedValue(undefined),
      assertCanHoldAnotherAd: jest.fn().mockResolvedValue(undefined),
      assertCanRenew: jest.fn().mockResolvedValue(undefined),
      reconcileListingsSafely: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ListingsService(
      db as never,
      {} as never,
      {} as never,
      entitlements as never,
    );
    jest.spyOn(service, 'findById').mockResolvedValue({
      userId: 'u1',
      status: 'draft',
      publishedAt: null,
      expiresAt: null,
      renewCount: 0,
      photos: [],
      ...existing,
    } as never);
    return { service, entitlements, set };
  }

  it('checks photos and a free slot when a draft is first published', async () => {
    const { service, entitlements, set } = setup({});
    await service.publish('u1', 'l1');
    expect(entitlements.assertPhotos).toHaveBeenCalled();
    expect(entitlements.assertCanHoldAnotherAd).toHaveBeenCalledWith(
      'u1',
      'l1',
    );
    expect(entitlements.assertCanRenew).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', renewCount: 0 }),
    );
    expect(entitlements.reconcileListingsSafely).toHaveBeenCalledWith('u1');
  });

  it('spends a renewal when an ad that already went live is re-published', async () => {
    const { service, entitlements, set } = setup({
      status: 'active',
      publishedAt: new Date(Date.now() - 86_400_000),
      expiresAt: new Date(Date.now() + 86_400_000),
      renewCount: 1,
    });
    await service.publish('u1', 'l1');
    expect(entitlements.assertCanRenew).toHaveBeenCalledWith('u1', 1);
    // still live → already counted, so no slot check
    expect(entitlements.assertCanHoldAnotherAd).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ renewCount: 2 }),
    );
  });

  it('refuses to re-publish an ad restricted by the plan', async () => {
    const { service, set } = setup({
      status: 'restricted',
      publishedAt: new Date(),
    });
    await expect(service.publish('u1', 'l1')).rejects.toMatchObject({
      response: { code: 'PLAN_RESTRICTED' },
    });
    expect(set).not.toHaveBeenCalled();
  });
});
