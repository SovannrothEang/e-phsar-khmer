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

/**
 * One work-experience entry, upserted by the client's own id (`PUT
 * /resume/experiences/:id`). Shape only: the end-vs-start rule and the
 * "current means no end date" rule are service-level (they are cross-field),
 * and mirrored by CHECKs on the table.
 */
export class UpsertExperienceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  company: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  position: string;

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

  @ApiProperty({ example: '2021-03-01' })
  @Matches(DATE_ONLY_PATTERN)
  startDate: string;

  @ApiPropertyOptional({ nullable: true, example: '2024-08-31' })
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
