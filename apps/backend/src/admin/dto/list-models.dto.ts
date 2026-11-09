import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * `GET /admin/models` query. Every parameter is optional, so the existing
 * callers keep working; the admin page sends `q`/`brandId`/`categoryId` and
 * the Product Specifications picker sends `brandId`/`subcategoryId`.
 */
export class ListModelsDto {
  /**
   * Matches model name/slug, brand name and the English category/subcategory
   * names. Trimmed before validation; `%` and `_` are escaped by the service.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

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
