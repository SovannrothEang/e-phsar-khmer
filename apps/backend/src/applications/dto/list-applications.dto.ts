import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { JobApplicationStatus } from '../applications.types';

const STATUSES: JobApplicationStatus[] = [
  'pending',
  'viewed',
  'hired',
  'rejected',
];

/** Filters shared by both /me lists: a status tab and a page of rows. */
export class ListApplicationsDto {
  @ApiProperty({
    description: 'Page number (1-based)',
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: 'Rows per page',
    default: 20,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: STATUSES, description: 'Filter by status' })
  @IsOptional()
  @IsIn(STATUSES)
  status?: JobApplicationStatus;

  /**
   * Narrows the seeker's list to one job. This is how the listing page asks
   * "have I already applied?" — the alternative (a field on
   * `GET /listings/:id`) would make the listings module depend on this one.
   */
  @ApiPropertyOptional({ description: 'Only applications to this listing' })
  @IsOptional()
  @IsUUID()
  listingId?: string;
}
