import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class LoginOtpDto {
  @ApiProperty({ example: '+85512345678' })
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phone must be a valid E.164 number',
  })
  phone: string;

  @ApiProperty({
    description: 'Account password — validated before the OTP is sent',
  })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;
}
