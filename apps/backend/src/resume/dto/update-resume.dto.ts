import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * The Job Preferences card's payload. The three pickers carry the option
 * labels the form shows (they are rendered back as text chips), not ids.
 */
export class JobPreferencesDto {
  @ApiProperty()
  @IsBoolean()
  openJob: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string | null;

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  category: string[];

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  location: string[];

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  jobType: string[];
}

/**
 * `PATCH /resume` — the document's two free-text blocks and the preference
 * row, following `UpdateProfileDto`'s contract exactly: `undefined` leaves the
 * stored value alone, an explicit `null` clears it (`summary`/`hobbies` become
 * `''`, `jobPreferences` deletes the row).
 */
export class UpdateResumeDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  hobbies?: string | null;

  @ApiPropertyOptional({ type: JobPreferencesDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => JobPreferencesDto)
  jobPreferences?: JobPreferencesDto | null;
}
