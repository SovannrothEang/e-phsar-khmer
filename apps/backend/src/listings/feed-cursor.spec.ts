import { PgDialect } from 'drizzle-orm/pg-core';
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
      const asc = orderByFor('price_asc').map((s) => toSql(s).sql);
      const desc = orderByFor('price_desc').map((s) => toSql(s).sql);
      expect(asc[0]).toMatch(/effective_price" asc nulls last/);
      expect(desc[0]).toMatch(/effective_price" desc nulls last/);
      expect(asc[1]).toMatch(/"id" desc/);
    });

    it('keeps newest on (created_at, id) desc', () => {
      const parts = orderByFor('newest').map((s) => toSql(s).sql);
      expect(parts[0]).toMatch(/created_at" desc/);
      expect(parts[1]).toMatch(/"id" desc/);
    });
  });

  describe('cursorPredicate', () => {
    it('binds the value and id as parameters', () => {
      const { sql, params } = toSql(
        cursorPredicate({ s: 'price_asc', v: '10.00', id: ID }),
      );
      expect(params).toEqual(expect.arrayContaining(['10.00', ID]));
      expect(sql).not.toContain('10.00');
    });

    it('asc: greater price, equal price with smaller id, or the null tail', () => {
      const { sql } = toSql(
        cursorPredicate({ s: 'price_asc', v: '10.00', id: ID }),
      );
      expect(sql).toMatch(/effective_price" > \$\d+::numeric/);
      expect(sql).toMatch(/effective_price" is null/);
    });

    it('desc: smaller price, and still the null tail', () => {
      const { sql } = toSql(
        cursorPredicate({ s: 'price_desc', v: '10.00', id: ID }),
      );
      expect(sql).toMatch(/effective_price" < \$\d+::numeric/);
      expect(sql).toMatch(/effective_price" is null/);
    });

    it('a null cursor stays inside the null tail', () => {
      const { sql } = toSql(
        cursorPredicate({ s: 'price_asc', v: null, id: ID }),
      );
      expect(sql).toMatch(/effective_price" is null and .*"id" < \$\d+/);
      expect(sql).not.toMatch(/numeric/);
    });

    it('newest compares the exact timestamp text, not a JS Date', () => {
      const v = '2026-09-30 10:15:42.123456+00';
      const { sql, params } = toSql(
        cursorPredicate({ s: 'newest', v, id: ID }),
      );
      expect(sql).toMatch(/created_at" < \$\d+::timestamptz/);
      expect(params).toContain(v); // microseconds intact
    });
  });
});
