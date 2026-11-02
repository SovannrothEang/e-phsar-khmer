import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: '+85512345678' })
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phone must be a valid E.164 number',
  })
  phone: string;

  @ApiProperty({ description: 'Reset code received via SMS' })
  @IsString()
  @Length(4, 8)
  code: string;

  // Same minimum as the register password (VerifyOtpDto.password). The 72 cap
  // is bcrypt's input limit (see ChangePasswordDto): bytes past it are ignored.
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(72)
  newPassword: string;
}
