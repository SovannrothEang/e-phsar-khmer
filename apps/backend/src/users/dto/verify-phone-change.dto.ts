import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyPhoneChangeDto {
  @ApiProperty({ example: '+85512345678' })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @ApiProperty({ example: '000000' })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  token: string;
}
