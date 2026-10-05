import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryListingsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcategorySlug?: string;

  @ApiPropertyOptional({ description: 'Search query against title' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: ['new', 'used'] })
  @IsOptional()
  @IsIn(['new', 'used'])
  condition?: 'new' | 'used';

  @ApiPropertyOptional({ description: 'Only honoured on /listings/me/all' })
  @IsOptional()
  @IsIn(['draft', 'active', 'expired', 'deleted'])
  status?: string;

  /**
   * One seller's ads — the public profile's post history.
   *
   * Feed-only, and deliberately NOT a substitute for `/listings/me/all`:
   * `findMine` is scoped to the caller's own JWT and does not filter by
   * status, so it must never back a page anyone can open. This one rides the
   * feed, which always ANDs `status = 'active'` — a draft, an expired ad or a
   * soft-deleted one stays invisible no matter what the caller sends.
   */
  @ApiPropertyOptional({
    description:
      'Only the active listings owned by this user (the public profile feed)',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by province slug' })
  @IsOptional()
  @IsString()
  provinceSlug?: string;

  @ApiPropertyOptional({
    description: 'Filter by district slug (requires provinceSlug)',
  })
  @IsOptional()
  @IsString()
  districtSlug?: string;

  @ApiPropertyOptional({
    description: "Filter by the ad's brand (listings.attributes->>'brand')",
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description:
      "Filter by the ad's body type (listings.attributes->>'bodyType')",
  })
  @IsOptional()
  @IsString()
  bodyType?: string;

  /**
   * Generic sibling of `brand`/`bodyType` for every OTHER attribute grid.
   *
   * Those two are only correct for the one family whose listings store those
   * exact keys. The browse pages render a grid per linked attribute set, and
   * the key a set's value lands under is the subcategory's own `field_schema`
   * key — `type` for House For Sale, `vehicleType` for Vehicles For Rent (from
   * the same `bodytypes` set that cars store as `bodyType`), `accessory`,
   * `network`, `jobType`, … So the web resolves the key and sends it here
   * rather than the backend guessing. Additive: both params are optional and
   * `brand`/`bodyType` behave exactly as before.
   */
  @ApiPropertyOptional({
    description:
      'Attribute key to filter on, e.g. `type` (listings.attributes->>attrKey). ' +
      'Requires attrValue; ignored on its own.',
  })
  @IsOptional()
  @Matches(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/, {
    message: 'attrKey must be a plain attribute key (letters/digits)',
  })
  attrKey?: string;

  @ApiPropertyOptional({
    description: 'Value for attrKey — the display name the post form wrote.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  attrValue?: string;
}
