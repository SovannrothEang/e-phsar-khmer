import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Date-only, both directions — never a full ISO timestamp. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** One education entry — `UpsertExperienceDto`'s shape with school/degree/major. */
export class UpsertEducationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  school: string;

  @ApiProperty()
  @IsString()
  @MaxLength(40)
  degree: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  major: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  provinceId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  districtId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  communeId?: string | null;

  @ApiProperty({ example: '2016-10-01' })
  @Matches(DATE_ONLY_PATTERN)
  startDate: string;

  @ApiPropertyOptional({ nullable: true, example: '2020-07-31' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN)
  endDate?: string | null;

  @ApiProperty()
  @IsBoolean()
  current: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
