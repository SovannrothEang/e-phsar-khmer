import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { JobApplicationStatus } from '../applications.types';

/**
 * The poster's verdict on an application. `pending` is deliberately absent:
 * it is a state an application starts in, never one it returns to — and a
 * PATCH that could reset a decision would make "hired" un-happen silently.
 */
export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ['viewed', 'hired', 'rejected'] })
  @IsIn(['viewed', 'hired', 'rejected'])
  status: Extract<JobApplicationStatus, 'viewed' | 'hired' | 'rejected'>;
}
