import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** `0XXXXXXXXX` (the form's local shape) or `855…`/`+855…`. */
const PHONE_PATTERN = /^(0\d{7,9}|\+?855\d{7,9})$/;
/** Date-only, both directions — never a full ISO timestamp. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Step 1 ("Add Personal Details") in full. The dialog only submits a valid
 * form, so `firstName`/`lastName`/`phones` are required here and everything
 * else is optional; a blank optional field arrives as `null` (the web action
 * maps `""` to `null`, because `@IsOptional` skips validation for null but not
 * for an empty string).
 *
 * `phones` holds the compact form (`0…`, `855…`, `+855…`) — the web action
 * strips spaces and dashes before sending, so the preview renders what the
 * database holds.
 */
export class UpdatePersonalDto {
  @ApiProperty()
  @IsString()
  @MaxLength(50)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1995-04-12' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN)
  dob?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationality?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  educationLevel?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  maritalStatus?: string | null;

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience?: number | null;

  @ApiProperty({ type: [String], maxItems: 3, example: ['012345678'] })
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @Matches(PHONE_PATTERN, { each: true })
  phones: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string | null;
}
