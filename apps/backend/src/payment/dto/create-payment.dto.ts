import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Min,
  MinLength,
} from 'class-validator';
import { paymentAttemptMethodEnum } from '../entity';
import { PAYMENT_PROVIDER_NAMES, type PaymentProviderName } from '../providers';

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

  @IsIn(PAYMENT_PROVIDER_NAMES)
  @ApiProperty({
    description: 'The payment gateway provider to attempt this payment against',
    enum: PAYMENT_PROVIDER_NAMES,
  })
  provider: PaymentProviderName;

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

  @IsOptional()
  @IsUrl({ require_tld: false })
  @ApiPropertyOptional({
    description:
      "Where the payer's browser is redirected after completing checkout " +
      'at the provider (e.g. ABA PayWay `continue_success_url`). This is ' +
      'NOT a webhook/callback URL — the server-to-server payment-result ' +
      'notification target is fixed server config, never client input, ' +
      'so a caller can never redirect that notification elsewhere.',
  })
  browserReturnUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @ApiPropertyOptional({
    description:
      "Where the payer's browser is redirected if they cancel checkout at " +
      'the provider (e.g. ABA PayWay `cancel_url`). Same trust boundary as ' +
      '`browserReturnUrl` — a browser redirect target, never the ' +
      'server-to-server webhook URL.',
  })
  browserCancelUrl?: string;
}
