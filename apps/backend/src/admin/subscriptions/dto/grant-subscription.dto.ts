import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GrantSubscriptionDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  termId: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
