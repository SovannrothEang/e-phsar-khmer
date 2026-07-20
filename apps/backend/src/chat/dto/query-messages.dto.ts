import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMessagesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 30;

  @ApiPropertyOptional({
    description: 'History mode: return messages strictly OLDER (newest first)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description:
      'Delta mode for polling: return messages strictly NEWER (oldest first)',
  })
  @IsOptional()
  @IsString()
  after?: string;
}
