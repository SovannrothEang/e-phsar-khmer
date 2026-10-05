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
