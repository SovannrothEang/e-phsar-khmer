import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(['user', 'admin', 'super_admin'])
  role?: 'user' | 'admin' | 'super_admin';

  @IsOptional()
  @IsEnum(['active', 'suspended', 'deleted'])
  status?: 'active' | 'suspended' | 'deleted';

  /** Derived, not stored: premium = an active subscription row. */
  @IsOptional()
  @IsEnum(['premium', 'normal'])
  accountType?: 'premium' | 'normal';

  /** Has a verified phone OR a verified email. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  verified?: boolean;

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
