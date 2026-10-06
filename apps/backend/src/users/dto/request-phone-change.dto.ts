import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RequestPhoneChangeDto {
  @ApiProperty({ example: '+85512345678' })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;
}
