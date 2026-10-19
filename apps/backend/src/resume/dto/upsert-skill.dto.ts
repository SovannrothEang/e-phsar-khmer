import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** One skill — Title and Level, both required by the form. */
export class UpsertSkillDto {
  @ApiProperty()
  @IsString()
  @MaxLength(50)
  title: string;

  @ApiProperty({ example: 'Advanced' })
  @IsString()
  @MaxLength(20)
  level: string;
}
