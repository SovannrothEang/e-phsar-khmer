import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class BlockUserDto {
  @ApiProperty({ description: 'ID of the user to block' })
  @IsUUID()
  userId: string;
}
