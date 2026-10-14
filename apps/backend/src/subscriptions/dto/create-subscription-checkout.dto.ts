import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSubscriptionCheckoutDto {
  @IsUUID()
  termId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey: string;

  @IsOptional()
  @IsIn(['bank'])
  method?: 'bank';
}
