import { and, ilike, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { listings } from '../db/schema/listings.schema';
import type { FeedOrdering, FeedSort } from './feed-cursor';

export const MAX_QUERY_TOKENS = 5;
export const MAX_TOKEN_LENGTH = 50;
/** Shorter tokens are never fuzzy-matched — trigram similarity is noise on them. */
export const FUZZY_MIN_TOKEN_LENGTH = 4;
/**
 * `word_similarity(token, title)` floor for a fuzzy match. pg_trgm's own
 * default (0.6) misses one-letter typos in short words: "toyta" vs
 * "Toyota Prius" scores 0.5.
 */
export const FUZZY_THRESHOLD = 0.4;

/**
 * Escapes LIKE metacharacters so user input matches literally. Postgres's
 * default LIKE escape character is the backslash, so no ESCAPE clause is
 * needed — but the backslash itself must be escaped first.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Whitespace-split, capped at MAX_QUERY_TOKENS tokens of MAX_TOKEN_LENGTH chars. */
export function tokenizeQuery(q: string | undefined): string[] {
  if (!q) return [];
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_QUERY_TOKENS)
    .map((t) => t.slice(0, MAX_TOKEN_LENGTH));
}

/**
 * Every token must appear in the title OR the description (AND across tokens),
 * as a case-insensitive substring. Substring (trigram-indexed) rather than
 * tsvector because Khmer has no word spaces for a text-search parser to split
 * on; this matches Khmer, partial words ("toyo") and model numbers alike.
 *
 * `fuzzy` additionally accepts a title that merely resembles a token
 * (typos). It is a fallback the feed uses only when the exact search finds
 * nothing: the similarity function cannot use the trigram index, and exact
 * matches should never be diluted by near-misses.
 */
export function keywordCondition(
  q: string | undefined,
  { fuzzy = false }: { fuzzy?: boolean } = {},
): SQL | undefined {
  const tokens = tokenizeQuery(q);
  if (tokens.length === 0) return undefined;
  return and(
    ...tokens.map((t) => {
      const pattern = `%${escapeLike(t)}%`;
      const exact = [
        ilike(listings.title, pattern),
        ilike(listings.description, pattern),
      ];
      return fuzzy && t.length >= FUZZY_MIN_TOKEN_LENGTH
        ? or(
            ...exact,
            sql`word_similarity(${t}, ${listings.title}) >= ${FUZZY_THRESHOLD}`,
          )
        : or(...exact);
    }),
  );
}

/** Whether a fuzzy retry could possibly differ from the exact search. */
export function canFuzzy(q: string | undefined): boolean {
  return tokenizeQuery(q).some((t) => t.length >= FUZZY_MIN_TOKEN_LENGTH);
}

/**
 * "Best match" score for `sort=relevance`, higher first:
 *   + 1    the whole phrase appears in the title
 *   + 0.5  the title starts with it
 *   + word_similarity(phrase, title) — 0..1, ranks near-misses and partial
 *     overlaps, and is what orders description-only matches (they score
 *     ~0 on the title terms above).
 * Cast to float8 so its text form round-trips exactly through the cursor.
 */
export function relevanceExpr(q: string): SQL<number> {
  const phrase = tokenizeQuery(q).join(' ');
  const esc = escapeLike(phrase);
  return sql<number>`(
    CASE WHEN ${listings.title} ILIKE ${`%${esc}%`} THEN 1 ELSE 0 END
    + CASE WHEN ${listings.title} ILIKE ${`${esc}%`} THEN 0.5 ELSE 0 END
    + word_similarity(${phrase}, ${listings.title})
  )::float8`;
}

/**
 * Resolves the requested sort for one query. "Best match" needs a keyword to
 * score against; without one it falls back to newest.
 */
export function resolveFeedOrdering(
  sort: FeedSort | undefined,
  q: string | undefined,
): FeedOrdering {
  if (sort === 'relevance' && q && tokenizeQuery(q).length > 0) {
    return { sort, score: relevanceExpr(q) };
  }
  return { sort: sort === undefined || sort === 'relevance' ? 'newest' : sort };
}
