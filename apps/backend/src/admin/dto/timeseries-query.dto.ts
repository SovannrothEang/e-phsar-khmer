import { IsEnum, IsOptional } from 'class-validator';

export type StatsRange = '7d' | '30d' | '90d';

export class TimeseriesQueryDto {
  @IsOptional()
  @IsEnum(['7d', '30d', '90d'])
  range: StatsRange = '90d';
}
