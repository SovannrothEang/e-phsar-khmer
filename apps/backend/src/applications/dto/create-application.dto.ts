import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Applying to a job. The cover note is optional — the résumé snapshot and the
 * resulting chat message are the substance of an application, and forcing a
 * sentence out of someone who already wrote a CV only produces "I want this
 * job." An empty note falls back to a default line in the chat message.
 */
export class CreateApplicationDto {
  @ApiPropertyOptional({
    description: 'Short note to the poster',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverNote?: string;
}
