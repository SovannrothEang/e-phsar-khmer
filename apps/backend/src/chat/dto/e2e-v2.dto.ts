import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  IsNotEmpty,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { E2eHeaderDto } from './e2e-header.dto';
import { MAX_ACTIVE_DEVICES } from '../e2e/e2e-devices.util';

export class E2eEnvelopeDto {
  @ApiProperty()
  @IsUUID()
  recipientDeviceId: string;

  @ApiProperty({
    type: E2eHeaderDto,
    description: 'Double Ratchet header for the session with this device',
  })
  @ValidateNested()
  @Type(() => E2eHeaderDto)
  header: E2eHeaderDto;

  @ApiProperty({
    description: 'base64 — the message content key, ratchet-encrypted',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  wrappedKey: string;
}

/**
 * Multi-device E2E payload. `body` (on SendMessageDto) is the message
 * encrypted ONCE under a random content key; each envelope wraps that key
 * for one device. Envelopes must cover exactly the recipient's active
 * devices plus the sender's other active devices — anything else is a 409
 * E2E_DEVICES_MISMATCH telling the client what to add and drop.
 */
export class E2eV2PayloadDto {
  @ApiProperty({ enum: [2] })
  @IsIn([2])
  v: 2;

  @ApiProperty()
  @IsUUID()
  senderDeviceId: string;

  @ApiProperty({ type: [E2eEnvelopeDto] })
  @IsArray()
  @ArrayMinSize(1)
  // Recipient's devices + sender's other devices.
  @ArrayMaxSize(MAX_ACTIVE_DEVICES * 2 - 1)
  @ValidateNested({ each: true })
  @Type(() => E2eEnvelopeDto)
  envelopes: E2eEnvelopeDto[];
}
