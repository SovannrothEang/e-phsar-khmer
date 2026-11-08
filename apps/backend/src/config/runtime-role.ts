/**
 * Which shape this process runs.
 *
 * `APP_ROLE` is read from the raw process environment **while the module graph
 * is built**, before `ConfigModule` has loaded `.env`: a `@Module` decorator
 * fixes its provider list at import time, so there is no later hook to consult.
 * On a host it must therefore be a real environment variable (Vercel project
 * env, a shell export), not a line in `.env`.
 *
 * A `.env`-only value is *not* benign — this was documented as harmless and it
 * is not. The module graph would keep `all` (five blocking Redis connections)
 * while the validated config applied `api` (pool 5, every background timer
 * off), the exact inverse of the budget this switch exists to enforce. So
 * `wiredAppRole` is captured once, here, while the raw environment is still
 * the whole story, and `assertRoleIsExported` refuses a boot where the two
 * readings disagree.
 */
export type AppRole = 'api' | 'worker' | 'all';

/** Anything unrecognised means `all`, the pre-2026-11 single-process shape. */
export function resolveAppRole(
  raw: string | undefined = process.env.APP_ROLE,
): AppRole {
  return raw === 'api' || raw === 'worker' ? raw : 'all';
}

/**
 * The role the module graph was actually built with. Captured at import time on
 * purpose: after `ConfigModule.forRoot()` runs, `process.env` also contains
 * whatever `.env` supplied and can no longer distinguish the two sources.
 */
export const wiredAppRole: AppRole = resolveAppRole();

/** `api` serves HTTP only; both other shapes start BullMQ workers. */
export function runsBackgroundWork(role: AppRole = wiredAppRole): boolean {
  return role !== 'api';
}

/**
 * Boot guard for the split-brain case: `configuration()` validates the value
 * `ConfigModule` loaded from `.env`, which by then can be one the module graph
 * never saw. Refusing to start beats running a shape nobody asked for.
 */
export function assertRoleIsExported(
  validated: AppRole,
  wired: AppRole = wiredAppRole,
): void {
  if (validated === wired) return;
  throw new Error(
    `APP_ROLE=${validated} was not visible while the module graph was built (it wired the ${wired} shape), so the process would serve one shape and budget another. It is being read from .env, which loads after the modules are imported — export it in the process environment (Vercel project env or a shell export) or drop it from .env.`,
  );
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
  role: AppRole = wiredAppRole,
): T[] {
  return runsBackgroundWork(role) ? [...providers] : [];
}
