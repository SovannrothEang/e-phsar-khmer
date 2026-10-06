import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OneTimePrekeyDto } from './one-time-prekey.dto';

export class AddDevicePrekeysDto {
  @ApiProperty({ type: [OneTimePrekeyDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OneTimePrekeyDto)
  oneTimePrekeys: OneTimePrekeyDto[];
}
