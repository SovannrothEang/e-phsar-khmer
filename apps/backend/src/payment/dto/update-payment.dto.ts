import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { paymentTransactionStatusEnum } from '../entity/payment-transaction';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentDto {
  @IsInt()
  @Min(1)
  @ApiProperty({
    description: 'The expected version of the payment transaction',
  })
  expectedVersion: number;

  @IsOptional()
  @IsEnum(paymentTransactionStatusEnum.enumValues)
  @ApiPropertyOptional({
    description: 'The status of the payment transaction',
    enum: paymentTransactionStatusEnum.enumValues,
  })
  status?: (typeof paymentTransactionStatusEnum.enumValues)[number];

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'A description for the payment transaction',
  })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'Why the override was made. Stored on the payment_status_history row ' +
      'next to the actor id.',
  })
  reason?: string;
}
