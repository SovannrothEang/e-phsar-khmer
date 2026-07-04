import { Global, Module } from '@nestjs/common';
import {
  DRIZZLE,
  PG_CLIENT,
  drizzleProvider,
  pgClientProvider,
} from './drizzle.provider';

@Global()
@Module({
  providers: [pgClientProvider, drizzleProvider],
  exports: [DRIZZLE, PG_CLIENT],
})
export class DbModule {}
