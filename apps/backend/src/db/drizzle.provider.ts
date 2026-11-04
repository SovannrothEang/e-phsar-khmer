import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';
export const PG_CLIENT = 'PG_CLIENT';

export type DbClient = PostgresJsDatabase<typeof schema>;

/**
 * Common supertype of the root client and a live `db.transaction()` handle
 * (PgTransaction extends PgDatabase). Use it on any method that must be able
 * to run inside the caller's transaction — e.g. OutboxService.enqueue.
 */
export type DbExecutor = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export const pgClientProvider = {
  provide: PG_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const url = configService.get<string>('database.url')!;
    const max = configService.get<number>('database.poolMax') ?? 20;
    // Statement/lock timeouts are startup parameters, and Supabase's
    // transaction-mode pooler rejects startup parameters it does not know, so
    // they stay off unless the operator opted in (see config.validation.ts).
    const statementTimeoutMs =
      configService.get<number>('database.statementTimeoutMs') ?? 0;
    const lockTimeoutMs =
      configService.get<number>('database.lockTimeoutMs') ?? 0;
    return postgres(url, {
      prepare: false,
      max,
      connect_timeout:
        configService.get<number>('database.connectTimeoutSeconds') ?? 10,
      idle_timeout:
        configService.get<number>('database.idleTimeoutSeconds') ?? 60,
      max_lifetime:
        configService.get<number>('database.maxLifetimeSeconds') ?? 1800,
      ...(statementTimeoutMs > 0 || lockTimeoutMs > 0
        ? {
            connection: {
              ...(statementTimeoutMs > 0
                ? { statement_timeout: statementTimeoutMs }
                : {}),
              ...(lockTimeoutMs > 0 ? { lock_timeout: lockTimeoutMs } : {}),
            },
          }
        : {}),
    });
  },
};

export const drizzleProvider = {
  provide: DRIZZLE,
  inject: [PG_CLIENT],
  useFactory: (client: postgres.Sql) => {
    return drizzle(client, { schema, casing: 'snake_case' });
  },
};
