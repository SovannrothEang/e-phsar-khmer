import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

/**
 * Highest page the endpoint accepts. `searchUsers` also uses this as the
 * `hasMore` ceiling, so the API never promises a page its own DTO rejects.
 */
export const MAX_SEARCH_PAGE = 100;

/**
 * Public user search. Deliberately its own DTO rather than `ListFollowsDto` or
 * `PaginationQueryDto`: the global pipe forbids unknown query keys, so a base
 * class would silently whitelist `limit`/`cursor` that this route ignores.
 */
export class SearchUsersDto {
  @ApiProperty({
    description:
      'Name or @username fragment. Whitespace-split (max 5 tokens); every ' +
      'token must prefix-match the start of the username, first name or last name.',
    minLength: 1,
    maxLength: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  q: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_PAGE)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Rows per page',
    default: 20,
    maximum: 50,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  pageSize?: number = 20;
}
