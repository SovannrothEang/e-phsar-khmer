import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min, MaxLength } from 'class-validator';

export class OneTimePrekeyDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  prekeyId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  publicKey: string;
}
