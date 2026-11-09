import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import {
  NEARBY_LIMIT_DEFAULT,
  NEARBY_LIMIT_MAX,
  NEARBY_RADIUS_KM_DEFAULT,
  NEARBY_RADIUS_KM_MAX,
  NEARBY_RADIUS_KM_MIN,
} from '../nearby';

/**
 * `enableImplicitConversion` has already turned an empty query value into 0 by
 * the time `@Transform`'s `value` arrives, and 0 is a valid coordinate
 * (`?lat=&lng=` would silently mean the Gulf of Guinea). Read the raw query
 * value from `obj` instead — the same escape hatch `QueryBoolean` uses in
 * `query-listings.dto.ts` — and map blank strings to NaN so `@IsNumber`
 * rejects them.
 */
const QueryNumber = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (raw === undefined || raw === null) return raw;
    if (typeof raw === 'string' && raw.trim() === '') return Number.NaN;
    return typeof raw === 'number' ? raw : Number(raw);
  });

export class QueryNearbyDto {
  @ApiProperty({
    description: 'Origin latitude in decimal degrees',
    minimum: -90,
    maximum: 90,
  })
  @QueryNumber()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: 'Origin longitude in decimal degrees',
    minimum: -180,
    maximum: 180,
  })
  @QueryNumber()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({
    default: NEARBY_RADIUS_KM_DEFAULT,
    minimum: NEARBY_RADIUS_KM_MIN,
    maximum: NEARBY_RADIUS_KM_MAX,
    description: 'Search radius in kilometres',
  })
  @IsOptional()
  @QueryNumber()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(NEARBY_RADIUS_KM_MIN)
  @Max(NEARBY_RADIUS_KM_MAX)
  radiusKm?: number = NEARBY_RADIUS_KM_DEFAULT;

  @ApiPropertyOptional({
    default: NEARBY_LIMIT_DEFAULT,
    minimum: 1,
    maximum: NEARBY_LIMIT_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(NEARBY_LIMIT_MAX)
  @Type(() => Number)
  limit?: number = NEARBY_LIMIT_DEFAULT;
}
