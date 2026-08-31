import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @ApiProperty({
    description:
      'Account password — verified against the existing user (login) or hashed into passwordHash when this verify creates the account (register)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password: string;

  @ApiPropertyOptional({
    description: 'Registration only: stored on the created user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Registration only: stored on the created user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
