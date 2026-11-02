import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListAdminListingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'expired', 'deleted', 'restricted', 'inactive'])
  status?:
    | 'draft'
    | 'active'
    | 'expired'
    | 'deleted'
    | 'restricted'
    | 'inactive';

  /** true → only staff-removed ads; false → only ads that were not. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  moderated?: boolean;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Category slug (the admin Listings category filter). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  /** Subcategory slug, scoped by `categorySlug` when both are present. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subcategorySlug?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;
}

/**
 * The reason is now read by the seller (it rides the take-down notification),
 * not just by staff — so it is required and whitespace-trimmed. `remove` and
 * `inactivate` share it.
 */
export class ModerateListingDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}

export class InactivateListingDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
