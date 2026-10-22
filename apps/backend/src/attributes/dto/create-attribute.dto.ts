import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateAttributeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nameKm?: string;

  @IsString()
  @Matches(SLUG_RE, {
    message: 'slug must be lowercase with hyphens only (e.g. my-option)',
  })
  slug: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  subcategoryIds?: string[];

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
