import { Context, Layer } from 'effect';
import type { DbClient } from './drizzle.provider';

export const DB_PROVIDER_ID = 'psa-npic/db/DbClient';

/**
 * Effect-side handle for the Drizzle client. This doesn't create a
 * connection — `DbClientTag.layer(db)` just wraps the instance NestJS
 * already built via the `DRIZZLE` provider (`drizzle.provider.ts`), so
 * Effect use-cases can `yield* DbClientTag` instead of taking `db` as a
 * plain parameter.
 */
export class DbClientTag extends Context.Service<DbClientTag, DbClient>()(
  DB_PROVIDER_ID,
) {
  static readonly layer = (db: DbClient) => Layer.succeed(DbClientTag, db);
}
