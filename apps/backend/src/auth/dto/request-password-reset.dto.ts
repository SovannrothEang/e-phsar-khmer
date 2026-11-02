import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty({
    description: 'Phone number (E.164), username, or email on the account',
    example: '+85512345678',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  // The users.email column's width is the widest identifier that can match.
  @MaxLength(255)
  identifier: string;
}
