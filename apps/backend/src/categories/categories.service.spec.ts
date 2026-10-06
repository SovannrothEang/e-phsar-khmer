import { PgDialect } from 'drizzle-orm/pg-core';
import { CategoriesService } from './categories.service';

interface Captured {
  where?: unknown;
  /** The single projected column, for the two listings subqueries. */
  column?: string;
}

function makeDb() {
  return { select: jest.fn() };
}

/**
 * `listCategories` reaches for `db.select` four times when it is scoped — the
 * two listings subqueries (which build the seller conditions) interleaved with
 * the two main queries — and twice when it is not. One chain shape serves all
 * four: the subqueries stop at `.where()`, the main queries carry on to
 * `.leftJoin().leftJoin().where().orderBy()`.
 */
function chain(capture: Captured) {
  const settle = (w: unknown) => {
    capture.where = w;
    return { orderBy: () => Promise.resolve([]) };
  };
  return {
    from: () => ({
      where: settle,
      leftJoin: () => ({ leftJoin: () => ({ where: settle }) }),
    }),
  };
}

describe('CategoriesService.listCategories seller scope', () => {
  const SELLER_ID = '86e83339-3433-4b96-a10f-4fc24b5c6bc8';

  let db: ReturnType<typeof makeDb>;
  let service: CategoriesService;

  /** Runs the method and compiles the WHERE of every query it made. */
  async function whereSql(userId?: string) {
    const captured: Captured[] = [];
    db.select.mockImplementation((projection: Record<string, unknown>) => {
      const capture: Captured = {};
      const values = Object.values(projection ?? {});
      // The subqueries select exactly one column; the main queries select a
      // bundle of table + translation columns, so this stays undefined there.
      if (values.length === 1)
        capture.column = (values[0] as { name?: string }).name;
      captured.push(capture);
      return chain(capture);
    });

    await service.listCategories('en', userId);

    const dialect = new PgDialect();
    return captured.map((c) => ({
      column: c.column,
      ...dialect.sqlToQuery(c.where as never),
    }));
  }

  beforeEach(() => {
    db = makeDb();
    service = new CategoriesService(db as never);
  });

  /**
   * Both levels are scoped, and the subcategory one is the point: it runs
   * whatever the caller asked for, so an unscoped run hangs every subcategory
   * in the catalogue (146) off the seller's categories — and the profile's
   * drill-down renders exactly that level.
   */
  it('filters on the seller and on active status in both scopes', async () => {
    const scopes = await whereSql(SELLER_ID);

    // `[0]` scopes the categories query, `[2]` the subcategory query.
    expect(scopes[0].column).toBe('category_id');
    expect(scopes[2].column).toBe('subcategory_id');

    for (const scope of [scopes[0], scopes[2]]) {
      expect(scope.sql).toContain('user_id');
      expect(scope.sql).toContain('status');
      // Bound as parameters, never spliced into the statement.
      expect(scope.sql).not.toContain(SELLER_ID);
      expect(scope.params).toContain(SELLER_ID);
      expect(scope.params).toContain('active');
    }
  });

  it('narrows the seller scope to exactly two listings subqueries', async () => {
    // The 2 subqueries plus the 2 main queries they are injected into.
    expect(await whereSql(SELLER_ID)).toHaveLength(4);
  });

  /**
   * The unscoped path is what every other caller uses — `buildRealDetailData`
   * resolves the post-detail breadcrumb out of `subcategories`, so a scope
   * leaking onto it would drop that crumb from every listing page.
   */
  it('leaves every query unscoped when no seller is given', async () => {
    const queries = await whereSql(undefined);

    expect(queries).toHaveLength(2);
    for (const q of queries) {
      expect(q.column).toBeUndefined();
      expect(q.sql).not.toContain('listings');
      expect(q.params).not.toContain(SELLER_ID);
    }
  });
});
