import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { paymentTransactionStatusEnum } from '../entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsEnum(paymentTransactionStatusEnum.enumValues)
  @ApiPropertyOptional({
    description: 'Filter payments by status',
    enum: paymentTransactionStatusEnum.enumValues,
  })
  status?: (typeof paymentTransactionStatusEnum.enumValues)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({
    description: 'The maximum number of payments to return',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    description: 'The offset for pagination',
    minimum: 0,
    default: 0,
  })
  @Type(() => Number)
  offset?: number;
}
