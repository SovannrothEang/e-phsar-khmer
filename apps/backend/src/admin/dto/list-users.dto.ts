import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
