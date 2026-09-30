import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { listings } from '../db/schema/listings.schema';

/**
 * Keyset pagination for the public feed, one ordering per sort.
 *
 * The cursor carries the sort it was issued for (`s`), the last row's sort
 * value (`v`) and its id â€” so a cursor from one sort can never be replayed
 * against another (it is ignored and the feed restarts at page 1).
 *
 * Every value round-trips as TEXT from Postgres (`created_at::text`,
 * `effective_price::text`), never through a JS Date: `created_at` has
 * microsecond precision, and a millisecond-truncated boundary silently skips
 * rows that share the millisecond. (The legacy `{createdAt, id}` cursor still
 * has that flaw; it is accepted only so already-issued links keep paging.)
 */

export const FEED_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'relevance',
] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export interface FeedCursor {
  s: FeedSort;
  /** Last row's sort value as text; null only for a price sort's null tail. */
  v: string | null;
  id: string;
  /**
   * Set when the first page fell back to fuzzy keyword matching, so every
   * later page stays in that mode instead of re-deciding it.
   */
  f?: true;
}

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
/** float8 text: `1.5`, `0.2857143`, `1e-05`. */
const FLOAT_RE = /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i;

export function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

/** Returns null for anything unusable: garbage, a foreign sort, a bad value. */
export function decodeCursor(
  raw: string | undefined,
  sort: FeedSort,
): FeedCursor | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return null;

  // Legacy cursor issued before sorts existed: `{ createdAt, id }`.
  if (!('s' in o)) {
    if (sort !== 'newest' || typeof o.createdAt !== 'string') return null;
    return isTimestamp(o.createdAt)
      ? { s: 'newest', v: o.createdAt, id: o.id }
      : null;
  }

  if (o.s !== sort) return null;
  const base = (v: string | null): FeedCursor =>
    o.f === true
      ? { s: sort, v, id: o.id as string, f: true }
      : { s: sort, v, id: o.id as string };
  if (sort === 'newest') {
    return typeof o.v === 'string' && isTimestamp(o.v) ? base(o.v) : null;
  }
  if (sort === 'relevance') {
    return typeof o.v === 'string' && FLOAT_RE.test(o.v) ? base(o.v) : null;
  }
  if (o.v === null) return base(null);
  return typeof o.v === 'string' && NUMERIC_RE.test(o.v) ? base(o.v) : null;
}

function isTimestamp(v: string): boolean {
  return !Number.isNaN(Date.parse(v));
}

/**
 * A sort resolved for one query. Relevance carries the score expression it
 * orders by (keyword-search.ts `resolveFeedOrdering`), so "relevance with no
 * score" cannot be represented — the type replaces a runtime check.
 */
export type FeedOrdering =
  | { sort: 'relevance'; score: SQL }
  | { sort: Exclude<FeedSort, 'relevance'> };

/** The expression whose text value a cursor carries, per sort. */
export function sortKeyExpr(ordering: FeedOrdering): SQL<string | null> {
  if (ordering.sort === 'relevance') {
    return sql<string>`(${ordering.score})::text`;
  }
  return ordering.sort === 'newest'
    ? sql<string>`${listings.createdAt}::text`
    : sql<string | null>`${listings.effectivePrice}::text`;
}

export function orderByFor(ordering: FeedOrdering): SQL[] {
  switch (ordering.sort) {
    case 'relevance':
      return [sql`${ordering.score} desc`, sql`${listings.id} desc`];
    case 'price_asc':
      return [
        sql`${listings.effectivePrice} asc nulls last`,
        sql`${listings.id} desc`,
      ];
    case 'price_desc':
      return [
        sql`${listings.effectivePrice} desc nulls last`,
        sql`${listings.id} desc`,
      ];
    default:
      return [sql`${listings.createdAt} desc`, sql`${listings.id} desc`];
  }
}

/**
 * "Rows strictly after the cursor" for the ordering it was issued under
 * (`decodeCursor` already rejects a cursor whose `s` differs). Price sorts
 * put nulls ("Negotiable") last, so a non-null cursor must still admit the
 * whole null tail, and a null cursor is already inside it.
 */
export function cursorPredicate(
  cursor: FeedCursor,
  ordering: FeedOrdering,
): SQL {
  const { v, id } = cursor;
  if (ordering.sort === 'newest') {
    const ts = sql`${v}::timestamptz`;
    return or(
      sql`${listings.createdAt} < ${ts}`,
      and(sql`${listings.createdAt} = ${ts}`, lt(listings.id, id)),
    )!;
  }
  if (ordering.sort === 'relevance') {
    const sc = ordering.score;
    const f = sql`${v}::float8`;
    return or(sql`${sc} < ${f}`, and(sql`${sc} = ${f}`, lt(listings.id, id)))!;
  }
  const ep = listings.effectivePrice;
  if (v === null) return and(isNull(ep), lt(listings.id, id))!;
  const n = sql`${v}::numeric`;
  const beyond =
    ordering.sort === 'price_asc' ? sql`${ep} > ${n}` : sql`${ep} < ${n}`;
  return or(beyond, and(eq(ep, sql`${n}`), lt(listings.id, id)), isNull(ep))!;
}
