import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class VerifyResetCodeDto {
  @ApiProperty({
    description:
      'The same phone number, username, or email the code was requested with',
    example: '+85512345678',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifier: string;

  @ApiProperty({ description: 'OTP token received via SMS' })
  @IsString()
  @Length(4, 8)
  token: string;
}
