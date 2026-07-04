import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '+85512345678' })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phone must be a valid E.164 number',
  })
  phone: string;

  @ApiPropertyOptional({ enum: ['en', 'km', 'zh'], default: 'en' })
  @IsOptional()
  @IsIn(['en', 'km', 'zh'])
  preferredLanguage?: string;
}
