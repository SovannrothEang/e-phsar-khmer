import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OneTimePrekeyDto } from './one-time-prekey.dto';

export class RegisterE2eKeysDto {
  @ApiProperty({ description: 'X25519 public key, base64 (DH)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  identityKey: string;

  @ApiProperty({
    description:
      'Ed25519 public key, base64 (signs signedPrekeyPublic) — separate from identityKey since X3DH needs the identity key to both DH and sign',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  identitySigningKey: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  registrationId: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  signedPrekeyId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  signedPrekeyPublic: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  signedPrekeySignature: string;

  @ApiProperty({ type: [OneTimePrekeyDto] })
  @IsArray()
  @ArrayMaxSize(200) // DoS guard — spec's steady-state batch is ~100
  @ValidateNested({ each: true })
  @Type(() => OneTimePrekeyDto)
  oneTimePrekeys: OneTimePrekeyDto[];
}
