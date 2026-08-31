import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
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
}
