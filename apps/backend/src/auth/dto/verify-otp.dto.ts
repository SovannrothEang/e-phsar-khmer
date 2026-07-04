import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+85512345678' })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phone must be a valid E.164 number',
  })
  phone: string;

  @ApiProperty({ description: 'OTP token received via SMS' })
  @IsString()
  @Length(4, 8)
  token: string;
}
