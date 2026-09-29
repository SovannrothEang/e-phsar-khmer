import { BrandsService } from './brands.service';

function makeDb() {
  return { select: jest.fn() };
}

function makeService(db: ReturnType<typeof makeDb>) {
  return new BrandsService(db as never);
}

describe('BrandsService', () => {
  let db: ReturnType<typeof makeDb>;
  let service: BrandsService;

  beforeEach(() => {
    db = makeDb();
    service = makeService(db);
  });

  describe('listBrands (no subcategory)', () => {
    it('returns all active brands', async () => {
      const row = {
        id: 'b1',
        slug: 'apple',
        name: 'Apple',
        icon: null,
        sortOrder: 0,
      };
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ orderBy: () => Promise.resolve([row]) }),
        }),
      });

      const result = await service.listBrands();
      expect(result).toEqual([row]);
    });

    it('returns empty array when no brands exist', async () => {
      db.select.mockReturnValue({
        from: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }),
      });

      const result = await service.listBrands();
      expect(result).toEqual([]);
    });
  });

  describe('listBrands (with subcategory slug)', () => {
    it('returns empty array when subcategory slug not found', async () => {
      db.select.mockReturnValue({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      });

      const result = await service.listBrands('unknown-slug');
      expect(result).toEqual([]);
    });

    it('returns brands linked to the subcategory', async () => {
      const brandRow = {
        id: 'b1',
        slug: 'apple',
        name: 'Apple',
        icon: null,
        sortOrder: 0,
      };
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'sub-1' }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            innerJoin: () => ({
              where: () => ({ orderBy: () => Promise.resolve([brandRow]) }),
            }),
          }),
        };
      });

      const result = await service.listBrands('phones');
      expect(result).toEqual([brandRow]);
    });

    it('returns empty array when subcategory has no linked brands', async () => {
      let selectCall = 0;
      db.select.mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([{ id: 'sub-1' }]),
              }),
            }),
          };
        }
        return {
          from: () => ({
            innerJoin: () => ({
              where: () => ({ orderBy: () => Promise.resolve([]) }),
            }),
          }),
        };
      });

      const result = await service.listBrands('phones');
      expect(result).toEqual([]);
    });
  });

  describe('listModels', () => {
    it('returns models for a brand', async () => {
      const row = {
        id: 'm1',
        slug: 'iphone-15',
        name: 'iPhone 15',
        sortOrder: 0,
      };
      db.select.mockReturnValue({
        from: () => ({
          where: () => ({ orderBy: () => Promise.resolve([row]) }),
        }),
      });

      const result = await service.listModels('brand-uuid');
      expect(result).toEqual([row]);
    });

    it('returns empty array when brand has no models', async () => {
      db.select.mockReturnValue({
        from: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }),
      });

      const result = await service.listModels('brand-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('listModels (scoped to a subcategory)', () => {
    it('returns [] for an unknown subcategory slug, without querying models', async () => {
      db.select.mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      });

      const result = await service.listModels('brand-uuid', 'not-a-slug');
      expect(result).toEqual([]);
      // The subcategory lookup short-circuits — no second select.
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('returns the scoped models when the slug resolves', async () => {
      const row = {
        id: 'm1',
        slug: 'ipad-pro',
        name: 'iPad Pro',
        sortOrder: 0,
      };
      const subquery = { from: () => ({ where: () => ({}) }) };
      db.select
        // 1. subcategory lookup
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([{ id: 'sub-1' }]) }),
          }),
        })
        // 2 + 3. the two id subqueries are *built* (never awaited), so their
        // chains only need to exist.
        .mockReturnValueOnce(subquery)
        .mockReturnValueOnce(subquery)
        // 4. the models query itself
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({ orderBy: () => Promise.resolve([row]) }),
          }),
        });

      const result = await service.listModels('brand-uuid', 'tablets');
      expect(result).toEqual([row]);
    });
  });
});
