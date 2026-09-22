/**
 * True if `err` is a Postgres unique-violation (23505) on the named
 * constraint. postgres.js throws a `PostgresError` with `code`/`constraint_name`
 * fields but no importable class we can `instanceof` against cheaply here, so
 * this checks shape instead.
 */
export function isUniqueViolation(
  err: unknown,
  constraintName: string,
): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; constraint_name?: unknown };
  return e.code === '23505' && e.constraint_name === constraintName;
}
