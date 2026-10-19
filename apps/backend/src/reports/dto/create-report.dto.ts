import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsEnum(['user', 'listing'])
  targetType: 'user' | 'listing';

  @IsUUID()
  targetId: string;

  @IsUUID()
  reasonId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Storage paths returned by `POST /files/sign` with the `report` scope. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @IsString({ each: true })
  @MaxLength(512, { each: true })
  imagePaths?: string[];
}
