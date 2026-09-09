import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  MinLength,
} from 'class-validator';
import { paymentAttemptMethodEnum } from '../entity/payment-attempt';

export class CreatePaymentDto {
  @IsString()
  @MinLength(1)
  @ApiProperty({
    description: 'A unique reference for the payment',
  })
  reference: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'A unique key to ensure idempotency of the payment request',
  })
  idempotencyKey: string;

  @IsNumber()
  @Min(0)
  @ApiProperty({
    description: 'The amount to be paid',
  })
  amount: number;

  @IsString()
  @Length(3, 3)
  @ApiProperty({
    description: 'The currency of the payment in ISO 4217 format',
  })
  currency: string;

  @IsString()
  @MinLength(1)
  @ApiProperty({
    description:
      'The payment gateway provider to attempt this payment against (e.g. aba_payway)',
  })
  provider: string;

  @IsIn(paymentAttemptMethodEnum.enumValues)
  @ApiProperty({
    description: 'The payment method for this attempt',
    enum: paymentAttemptMethodEnum.enumValues,
  })
  method: (typeof paymentAttemptMethodEnum.enumValues)[number];

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'The ID of the order associated with the payment',
  })
  orderId?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'A description for the payment',
  })
  description?: string;
}
