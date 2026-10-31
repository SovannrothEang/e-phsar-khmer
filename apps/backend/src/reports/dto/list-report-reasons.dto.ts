import { IsEnum } from 'class-validator';

export class ListReportReasonsDto {
  @IsEnum(['user', 'listing'])
  targetType: 'user' | 'listing';
}
