import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Categories ──────────────────────────────────────────────
export class CreateSubCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Matches(SLUG_RE, { message: 'slug must be lowercase-hyphenated' })
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSubCategoryDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @Matches(SLUG_RE) slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Plans ───────────────────────────────────────────────────
export class CreateSubPlanDto {
  @IsUUID() categoryId: string;
  @IsString() @MinLength(1) name: string;
  @IsString()
  @Matches(SLUG_RE, { message: 'slug must be lowercase-hyphenated' })
  slug: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSubPlanDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @Matches(SLUG_RE) slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Packages ────────────────────────────────────────────────
export class CreateSubPackageDto {
  @IsUUID() planId: string;
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsInt() @Min(0) photos?: number;
  @IsOptional() @IsInt() @Min(0) ads?: number;
  @IsOptional() @IsInt() @Min(0) renews?: number;
  @IsOptional() @IsInt() @Min(0) autoRenews?: number;
  @IsOptional() @IsInt() @Min(0) videos?: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSubPackageDto {
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsInt() @Min(0) photos?: number;
  @IsOptional() @IsInt() @Min(0) ads?: number;
  @IsOptional() @IsInt() @Min(0) renews?: number;
  @IsOptional() @IsInt() @Min(0) autoRenews?: number;
  @IsOptional() @IsInt() @Min(0) videos?: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Terms ───────────────────────────────────────────────────
export class CreateSubTermDto {
  @IsUUID() packageId: string;
  @IsString() @MinLength(1) name: string;
  @IsInt() @Min(1) durationValue: number;
  @IsEnum(['day', 'month', 'year']) durationUnit: 'day' | 'month' | 'year';
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsEnum(['percent', 'amount']) discountType?:
    | 'percent'
    | 'amount';
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateSubTermDto {
  @IsOptional() @IsUUID() packageId?: string;
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsInt() @Min(1) durationValue?: number;
  @IsOptional() @IsEnum(['day', 'month', 'year']) durationUnit?:
    | 'day'
    | 'month'
    | 'year';
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsEnum(['percent', 'amount']) discountType?:
    | 'percent'
    | 'amount';
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
