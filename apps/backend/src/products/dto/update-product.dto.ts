import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ProductSpecGroupDto } from './product-spec-group.dto';

/**
 * `modelId` is deliberately absent: the spec page is tied to one model and
 * re-pointing it would orphan the listings that reference it. The global
 * whitelist pipe rejects it if sent.
 */
export class UpdateProductDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductSpecGroupDto)
  specGroups?: ProductSpecGroupDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
