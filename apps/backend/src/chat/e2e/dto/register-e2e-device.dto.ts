import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { RegisterE2eKeysDto } from './register-e2e-keys.dto';

/**
 * Same public material as the v1 registration. Registering an identity key
 * this user already has claims (and reactivates) that device instead of
 * creating a second one — that's how a browser from before multi-device
 * adopts its backfilled device row without generating new keys.
 */
export class RegisterE2eDeviceDto extends RegisterE2eKeysDto {
  @ApiPropertyOptional({
    description: 'e.g. "Chrome · Windows" — shown in approval prompts',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

export class HeartbeatDeviceDto {
  @ApiPropertyOptional({ description: 'Refreshes the device label' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
