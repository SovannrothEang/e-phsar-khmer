import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class PaymentWebhookDto {
  @IsString()
  @MinLength(1)
  @ApiProperty({ description: 'Which gateway sent this webhook' })
  provider: string;

  @IsString()
  @MinLength(1)
  @ApiProperty({
    description:
      "The provider's own event id — dedupe key together with `provider`",
  })
  providerEventId: string;

  @IsString()
  @MinLength(1)
  @ApiProperty({ description: "The provider's event type/name" })
  eventType: string;

  @IsObject()
  @ApiProperty({ description: 'The raw webhook body' })
  payload: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  @ApiProperty({
    required: false,
    description: 'The payment_attempt this event correlates to, if known',
  })
  paymentAttemptId?: string;
}
