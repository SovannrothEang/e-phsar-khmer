/**
 * Next.js hands a page component its dynamic route params still
 * percent-encoded, while the metadata resolver passes `generateMetadata` the
 * decoded form. A Khmer handle therefore reached the profile pages as
 * "%E1%9E%9B…", the backend was asked for that literal string, and every
 * non-ASCII account 404'd while its listing rendered fine.
 *
 * Decode once at the route boundary, where the value's provenance is known.
 * An already-decoded value passes through unchanged, and a malformed escape
 * sequence is left as-is rather than throwing a 500 out of the page.
 */
export function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * A page's `searchParams` with the `undefined` entries removed, ready for a
 * next-intl `{ href: { query } }` object (its query accepts no `undefined`).
 */
export function definedQuery(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(sp).filter(([, value]) => value !== undefined),
  ) as Record<string, string | string[]>;
}
