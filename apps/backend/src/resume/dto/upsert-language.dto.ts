import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** One language — Title and Level, both required by the form. */
export class UpsertLanguageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(50)
  title: string;

  @ApiProperty({ example: 'Native' })
  @IsString()
  @MaxLength(20)
  level: string;
}
