import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PG_CLIENT } from '../db/drizzle.provider';
import type postgres from 'postgres';

@ApiTags('health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(@Inject(PG_CLIENT) private readonly sql: postgres.Sql) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    let dbStatus: 'up' | 'down' = 'up';
    try {
      await this.sql`select 1`;
    } catch {
      dbStatus = 'down';
    }
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      db: dbStatus,
    };
  }
}
