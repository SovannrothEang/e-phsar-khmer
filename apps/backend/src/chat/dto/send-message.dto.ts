import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ description: 'User to send the message to' })
  @IsUUID()
  recipientId: string;

  // At least one of body/imagePath is required — enforced in the service
  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional({
    description: 'Listing shown as a context card with this message',
  })
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @ApiPropertyOptional({
    description: 'Storage path from POST /files/sign with scope=chat',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagePath?: string;
}
