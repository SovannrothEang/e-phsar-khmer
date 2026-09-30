import { and, ilike, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { listings } from '../db/schema/listings.schema';

export const MAX_QUERY_TOKENS = 5;
export const MAX_TOKEN_LENGTH = 50;

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
 */
export function keywordCondition(q: string | undefined): SQL | undefined {
  const tokens = tokenizeQuery(q);
  if (tokens.length === 0) return undefined;
  return and(
    ...tokens.map((t) => {
      const pattern = `%${escapeLike(t)}%`;
      return or(
        ilike(listings.title, pattern),
        ilike(listings.description, pattern),
      );
    }),
  );
}
