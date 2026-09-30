import { PgDialect } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  cursorPredicate,
  decodeCursor,
  encodeCursor,
  orderByFor,
} from './feed-cursor';
import type { FeedCursor } from './feed-cursor';

const ID = '7d3c1a52-0000-4000-8000-000000000001';
const toSql = (s: SQL) => new PgDialect().sqlToQuery(s);
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64');

describe('feed cursor', () => {
  describe('encode/decode round-trip', () => {
    const cases: FeedCursor[] = [
      { s: 'newest', v: '2026-09-30 10:15:42.123456+00', id: ID },
      { s: 'price_asc', v: '1299.00', id: ID },
      { s: 'price_desc', v: '9.50', id: ID },
      { s: 'price_asc', v: null, id: ID },
      { s: 'price_desc', v: null, id: ID },
    ];
    it.each(cases)('$s / $v', (c) => {
      expect(decodeCursor(encodeCursor(c), c.s)).toEqual(c);
    });
  });

  it('round-trips relevance scores, including float8 exponent form', () => {
    for (const v of ['1.5', '0.2857143', '1e-05']) {
      const c: FeedCursor = { s: 'relevance', v, id: ID };
      expect(decodeCursor(encodeCursor(c), 'relevance')).toEqual(c);
    }
    const nullScore = b64({ s: 'relevance', v: null, id: ID });
    expect(decodeCursor(nullScore, 'relevance')).toBeNull();
  });

  it('carries the fuzzy flag, and only a literal true', () => {
    const fuzzy = encodeCursor({
      s: 'newest',
      v: '2026-09-30',
      id: ID,
      f: true,
    });
    expect(decodeCursor(fuzzy, 'newest')?.f).toBe(true);
    const bogus = b64({ s: 'newest', v: '2026-09-30', id: ID, f: 'yes' });
    expect(decodeCursor(bogus, 'newest')).not.toHaveProperty('f');
  });

  it('relevance predicate compares the score as float8', () => {
    const score = sql`(1)::float8`;
    const { sql: text, params } = toSql(
      cursorPredicate(
        { s: 'relevance', v: '1.25', id: ID },
        { sort: 'relevance', score },
      ),
    );
    expect(text).toMatch(/< \$\d+::float8/);
    expect(params).toEqual(expect.arrayContaining(['1.25', ID]));
  });

  it('accepts the legacy {createdAt, id} cursor for newest', () => {
    const legacy = b64({ createdAt: '2026-09-30T10:15:42.123Z', id: ID });
    expect(decodeCursor(legacy, 'newest')).toEqual({
      s: 'newest',
      v: '2026-09-30T10:15:42.123Z',
      id: ID,
    });
  });

  it('ignores the legacy cursor under a price sort', () => {
    const legacy = b64({ createdAt: '2026-09-30T10:15:42.123Z', id: ID });
    expect(decodeCursor(legacy, 'price_asc')).toBeNull();
  });

  it('ignores a cursor issued for a different sort', () => {
    const c = encodeCursor({ s: 'price_asc', v: '10.00', id: ID });
    expect(decodeCursor(c, 'price_desc')).toBeNull();
    expect(decodeCursor(c, 'newest')).toBeNull();
  });

  it.each([
    ['not base64 json', '%%%'],
    ['json but not an object', b64(42)],
    ['missing id', b64({ s: 'newest', v: '2026-09-30' })],
    ['newest with null value', b64({ s: 'newest', v: null, id: ID })],
    ['newest with a bad date', b64({ s: 'newest', v: 'nope', id: ID })],
    [
      'price with a non-numeric value',
      b64({ s: 'price_asc', v: '1;drop', id: ID }),
    ],
    ['unknown sort', b64({ s: 'most_viewed', v: '1', id: ID })],
  ])('rejects %s', (_label, raw) => {
    expect(decodeCursor(raw, 'price_asc')).toBeNull();
    expect(decodeCursor(raw, 'newest')).toBeNull();
  });

  it('returns null for an absent cursor', () => {
    expect(decodeCursor(undefined, 'newest')).toBeNull();
  });

  describe('orderByFor', () => {
    it('puts negotiable (null) prices last in both directions', () => {
      const asc = orderByFor({ sort: 'price_asc' }).map((s) => toSql(s).sql);
      const desc = orderByFor({ sort: 'price_desc' }).map((s) => toSql(s).sql);
      expect(asc[0]).toMatch(/effective_price" asc nulls last/);
      expect(desc[0]).toMatch(/effective_price" desc nulls last/);
      expect(asc[1]).toMatch(/"id" desc/);
    });

    it('keeps newest on (created_at, id) desc', () => {
      const parts = orderByFor({ sort: 'newest' }).map((s) => toSql(s).sql);
      expect(parts[0]).toMatch(/created_at" desc/);
      expect(parts[1]).toMatch(/"id" desc/);
    });
  });

  describe('cursorPredicate', () => {
    it('binds the value and id as parameters', () => {
      const { sql, params } = toSql(
        cursorPredicate(
          { s: 'price_asc', v: '10.00', id: ID },
          { sort: 'price_asc' },
        ),
      );
      expect(params).toEqual(expect.arrayContaining(['10.00', ID]));
      expect(sql).not.toContain('10.00');
    });

    it('asc: greater price, equal price with smaller id, or the null tail', () => {
      const { sql } = toSql(
        cursorPredicate(
          { s: 'price_asc', v: '10.00', id: ID },
          { sort: 'price_asc' },
        ),
      );
      expect(sql).toMatch(/effective_price" > \$\d+::numeric/);
      expect(sql).toMatch(/effective_price" is null/);
    });

    it('desc: smaller price, and still the null tail', () => {
      const { sql } = toSql(
        cursorPredicate(
          { s: 'price_desc', v: '10.00', id: ID },
          { sort: 'price_desc' },
        ),
      );
      expect(sql).toMatch(/effective_price" < \$\d+::numeric/);
      expect(sql).toMatch(/effective_price" is null/);
    });

    it('a null cursor stays inside the null tail', () => {
      const { sql } = toSql(
        cursorPredicate(
          { s: 'price_asc', v: null, id: ID },
          { sort: 'price_asc' },
        ),
      );
      expect(sql).toMatch(/effective_price" is null and .*"id" < \$\d+/);
      expect(sql).not.toMatch(/numeric/);
    });

    it('newest compares the exact timestamp text, not a JS Date', () => {
      const v = '2026-09-30 10:15:42.123456+00';
      const { sql, params } = toSql(
        cursorPredicate({ s: 'newest', v, id: ID }, { sort: 'newest' }),
      );
      expect(sql).toMatch(/created_at" < \$\d+::timestamptz/);
      expect(params).toContain(v); // microseconds intact
    });
  });
});
