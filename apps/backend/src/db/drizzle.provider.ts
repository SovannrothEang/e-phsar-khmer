import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';
export const PG_CLIENT = 'PG_CLIENT';

export type DbClient = PostgresJsDatabase<typeof schema>;

export const pgClientProvider = {
  provide: PG_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const url = configService.get<string>('database.url')!;
    return postgres(url, { prepare: false });
  },
};

export const drizzleProvider = {
  provide: DRIZZLE,
  inject: [PG_CLIENT],
  useFactory: (client: postgres.Sql) => {
    return drizzle(client, { schema, casing: 'snake_case' });
  },
};
