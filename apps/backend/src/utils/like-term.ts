/**
 * Escapes the caller's own LIKE wildcards so a search for "100%" or "a_b"
 * matches literally instead of as a pattern. (Backslash is Postgres's default
 * LIKE escape character.)
 */
export const escapeLike = (q: string): string =>
  q.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Wraps a user search string in `%…%` with its wildcards escaped. */
export const likeTerm = (q: string): string => `%${escapeLike(q)}%`;
