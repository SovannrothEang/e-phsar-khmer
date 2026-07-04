import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListingPhotoDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty()
  @IsString()
  path: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sort: number;
}
