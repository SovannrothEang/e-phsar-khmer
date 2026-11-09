import { PgDialect } from 'drizzle-orm/pg-core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminModelsService } from './admin-models.service';
import { ListModelsDto } from './dto/list-models.dto';

const dialect = new PgDialect();
const BRAND = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';
const SUBCATEGORY = '33333333-3333-4333-8333-333333333333';

interface Capture {
  rowsWhere?: unknown;
  countWhere?: unknown;
  linksWhere?: unknown;
  orderBy: unknown[];
  limit?: unknown;
  offset?: unknown;
}

/** A thenable Drizzle-style chain that records the clause it was given. */
function chain(
  result: unknown[],
  capture: Capture,
  kind: 'rows' | 'count' | 'links',
) {
  const c: Record<string, unknown> = {};
  c.from = () => c;
  c.where = (arg: unknown) => {
    if (kind === 'rows') capture.rowsWhere = arg;
    if (kind === 'count') capture.countWhere = arg;
    if (kind === 'links') capture.linksWhere = arg;
    return c;
  };
  if (kind === 'rows') {
    c.orderBy = (...args: unknown[]) => {
      capture.orderBy = args;
      return c;
    };
    c.limit = (n: unknown) => {
      capture.limit = n;
      return c;
    };
    c.offset = (n: unknown) => {
      capture.offset = n;
      return c;
    };
  }
  c.then = (resolve: (value: unknown[]) => unknown) =>
    Promise.resolve(result).then(resolve);
  return c;
}

function makeService(
  options: {
    rows?: unknown[];
    total?: number;
    links?: unknown[];
  } = {},
) {
  const capture: Capture = { orderBy: [] };
  const rows = options.rows ?? [];
  const total = options.total ?? rows.length;
  const links = options.links ?? [];
  const db = {
    select: jest.fn((fields?: Record<string, unknown>) => {
      if (fields && 'value' in fields) {
        return chain([{ value: total }], capture, 'count');
      }
      if (fields && 'modelId' in fields) {
        return chain(links, capture, 'links');
      }
      return chain(rows, capture, 'rows');
    }),
  };
  const service = new AdminModelsService(db as never, {} as never);
  return { service, capture, db };
}

const compiled = (where: unknown) => dialect.sqlToQuery(where as never);

describe('AdminModelsService.list filters', () => {
  it('matches q across model, brand and English category/subcategory names', async () => {
    const { service, capture } = makeService();

    await service.list({ q: '100%' });

    const { sql, params } = compiled(capture.rowsWhere);
    expect(sql).toContain('"models"."name" ilike');
    expect(sql).toContain('"models"."slug" ilike');
    expect(sql).toContain('from "brands"');
    expect(sql).toContain('"subcategory_translations"');
    expect(sql).toContain('"category_translations"');
    expect(sql).toContain("st.locale = 'en'");
    expect(sql).toContain("ct.locale = 'en'");
    // likeTerm escapes the caller's wildcard, so "100%" is a literal.
    expect(params).toContain('%100\\%%');
    // The count query must carry the same predicate or the total lies.
    expect(compiled(capture.countWhere).sql).toContain(
      '"subcategory_translations"',
    );
  });

  it('filters by brand, category and subcategory through the link table', async () => {
    const { service, capture } = makeService();

    await service.list({
      brandId: BRAND,
      categoryId: CATEGORY,
      subcategoryId: SUBCATEGORY,
    });

    const { sql, params } = compiled(capture.rowsWhere);
    expect(sql).toContain('"models"."brand_id"');
    expect(sql).toContain('"model_subcategory_links"');
    expect(sql).toContain('s.category_id =');
    expect(sql).toContain('msl.subcategory_id =');
    expect(params).toEqual(
      expect.arrayContaining([BRAND, CATEGORY, SUBCATEGORY]),
    );
  });

  it('paginates and reports the repo PaginationMeta', async () => {
    const { service, capture } = makeService({
      rows: [{ id: 'm1' }, { id: 'm2' }],
      total: 5,
    });

    const result = await service.list({ page: 2, pageSize: 2 });

    expect(capture.limit).toBe(2);
    expect(capture.offset).toBe(2);
    expect(result.meta).toEqual({
      nextCursor: null,
      hasMore: true,
      limit: 2,
      total: 5,
      page: 2,
      pageSize: 2,
    });
    expect(result.data).toHaveLength(2);
  });

  it('defaults to page 1 with 20 rows and no filter', async () => {
    const { service, capture } = makeService();

    await service.list({});

    expect(capture.limit).toBe(20);
    expect(capture.offset).toBe(0);
    expect(capture.rowsWhere).toBeUndefined();
  });

  it('orders by sortOrder, name and id for a stable page', async () => {
    const { service, capture } = makeService();

    await service.list({});

    const orders = capture.orderBy.map(
      (order) => dialect.sqlToQuery(order as never).sql,
    );
    expect(orders).toHaveLength(3);
    expect(orders[0]).toContain('sort_order');
    expect(orders[1]).toContain('"name"');
    expect(orders[2]).toContain('"id"');
  });

  it('loads links only for the page rows', async () => {
    const { service, capture } = makeService({
      rows: [{ id: 'm1' }],
      links: [{ modelId: 'm1', subcategoryId: SUBCATEGORY }],
    });

    const result = await service.list({});

    expect(compiled(capture.linksWhere).params).toContain('m1');
    expect(result.data[0]).toMatchObject({
      id: 'm1',
      subcategoryIds: [SUBCATEGORY],
    });
  });
});

describe('ListModelsDto validation', () => {
  it('rejects a malformed id', async () => {
    const errors = await validate(
      plainToInstance(ListModelsDto, { brandId: 'not-a-uuid' }),
    );
    expect(errors.some((error) => error.property === 'brandId')).toBe(true);
  });

  it('rejects an over-long q and an over-max pageSize', async () => {
    const longQ = await validate(
      plainToInstance(ListModelsDto, { q: 'x'.repeat(101) }),
    );
    expect(longQ.some((error) => error.property === 'q')).toBe(true);

    const longPage = await validate(
      plainToInstance(ListModelsDto, { pageSize: 101 }),
    );
    expect(longPage.some((error) => error.property === 'pageSize')).toBe(true);
  });

  it('trims q and converts numeric strings', async () => {
    const dto = plainToInstance(ListModelsDto, {
      q: '  iphone  ',
      page: '2',
      pageSize: '10',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
    expect(dto.q).toBe('iphone');
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(10);
  });
});
