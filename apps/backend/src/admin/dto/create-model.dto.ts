import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateModelDto {
  @IsUUID()
  brandId: string;

  @IsString()
  @Matches(SLUG_RE, {
    message: 'slug must be lowercase with hyphens only (e.g. my-model)',
  })
  slug: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Which subcategories this model belongs to. Optional, but a model left
   *  with none is treated as unclassified and shows under every subcategory
   *  its brand is linked to. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  subcategoryIds?: string[];
}
