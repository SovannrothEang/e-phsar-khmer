/**
 * Which shape this process runs.
 *
 * `APP_ROLE` is read from the raw process environment **while the module graph
 * is built**, before `ConfigModule` has loaded `.env`. On a host it must
 * therefore be a real environment variable (Vercel project env, a shell
 * export), not a line in `.env`; a `.env`-only value still reaches the
 * validated config, but the module wiring below keeps the default. That
 * mismatch is benign: `all` is a superset of both explicit roles.
 */
export type AppRole = 'api' | 'worker' | 'all';

/** Anything unrecognised means `all`, the pre-2026-11 single-process shape. */
export function resolveAppRole(
  raw: string | undefined = process.env.APP_ROLE,
): AppRole {
  return raw === 'api' || raw === 'worker' ? raw : 'all';
}

/** `api` serves HTTP only; both other shapes start BullMQ workers. */
export function runsBackgroundWork(role: AppRole = resolveAppRole()): boolean {
  return role !== 'api';
}

/**
 * Provider list for the `api` role.
 *
 * A `@Processor` provider makes BullExplorer construct a `Worker`, which opens
 * a dedicated blocking Redis connection per processor — the five connections
 * the connection-budget review counted. Dropping the provider is the only way
 * to not open them; a runtime `if` inside `process()` would leave the socket
 * open. Schedulers stay registered (they only upsert a repeatable job on the
 * shared client) so an admin edit made through the API still queues work for
 * whichever instance drains it.
 */
export function backgroundProviders<T>(
  providers: readonly T[],
  role: AppRole = resolveAppRole(),
): T[] {
  return runsBackgroundWork(role) ? [...providers] : [];
}
