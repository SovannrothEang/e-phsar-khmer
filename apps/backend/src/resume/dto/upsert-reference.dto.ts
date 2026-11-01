import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** `0XXXXXXXXX` (the form's local shape) or `855…`/`+855…`. */
const PHONE_PATTERN = /^(0\d{7,9}|\+?855\d{7,9})$/;

/** One reference: name, company and position are required, the rest optional. */
export class UpsertReferenceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  company: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  position: string;

  @ApiProperty({ type: [String], maxItems: 3, example: ['012345678'] })
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @Matches(PHONE_PATTERN, { each: true })
  phones: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
}
