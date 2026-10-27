import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ProductSpecGroupDto } from './product-spec-group.dto';

export class CreateProductDto {
  /** The existing model row this spec page documents (immutable afterwards). */
  @IsUUID()
  modelId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductSpecGroupDto)
  specGroups: ProductSpecGroupDto[];

  /** Defaults to true — an admin creating a page intends it to be visible. */
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
