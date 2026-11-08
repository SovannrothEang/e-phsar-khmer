import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { SOCIAL_STATE_PATTERN } from '../social-state.service';

export class SocialLoginDto {
  @ApiProperty({ enum: ['google', 'facebook'] })
  @IsIn(['google', 'facebook'])
  provider: 'google' | 'facebook';

  @ApiProperty({
    description:
      'The single-use nonce returned by GET /auth/social/:provider/url. Required: a callback without a live nonce is rejected.',
  })
  @IsString()
  @Matches(SOCIAL_STATE_PATTERN)
  state: string;

  @ApiPropertyOptional({ enum: ['user', 'admin'] })
  @IsOptional()
  @IsIn(['user', 'admin'])
  mode?: 'user' | 'admin';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  accessToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  redirectUri?: string;
}
