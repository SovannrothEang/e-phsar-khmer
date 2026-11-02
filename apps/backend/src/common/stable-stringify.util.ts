/**
 * Deterministic JSON serialisation — object keys are sorted recursively so
 * two logically-identical values (same keys, any insertion order) always
 * produce the same string. Used where a hash of a payload has to be stable
 * across calls (see `NotificationsService.buildSmsDedupeKey`), unlike plain
 * `JSON.stringify`, which preserves insertion order.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  // Dates are objects; without this branch they fall through below and
  // serialise as `{}`, so two different dates would hash identically.
  // `JSON.stringify` turns a Date into its quoted ISO string — match that.
  if (value instanceof Date) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
  return `{${entries.join(',')}}`;
}
