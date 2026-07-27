import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateReportReasonDto {
  @IsEnum(['user', 'listing'])
  targetType: 'user' | 'listing';

  @IsString()
  @MinLength(1)
  reason: string;
}

export class UpdateReportReasonDto {
  @IsOptional() @IsString() @MinLength(1) reason?: string;
}

export class UpdateReportStatusDto {
  @IsEnum(['pending', 'approved', 'rejected'])
  status: 'pending' | 'approved' | 'rejected';
}
