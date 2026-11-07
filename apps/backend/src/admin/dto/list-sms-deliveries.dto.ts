import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * The statuses stored in `sms_deliveries` (`smsDeliveryStatusEnum`). Kept as a
 * plain list rather than imported from the schema so the DTO stays a boundary
 * type: a new status is a deliberate change in both places.
 */
const SMS_DELIVERY_STATUSES = ['queued', 'sent', 'failed', 'skipped'] as const;

export class ListSmsDeliveriesDto {
  @IsOptional()
  @IsIn(SMS_DELIVERY_STATUSES)
  status?: (typeof SMS_DELIVERY_STATUSES)[number];

  /**
   * Only the deliveries for one account. OTP sends carry no `userId` (the
   * registering phone has no row yet), so they are never in this filter.
   */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number = 20;
}
