import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class E2eHeaderDto {
  @ApiProperty({ enum: [1] })
  @IsIn([1])
  v: 1;

  @ApiProperty({ description: "Sender's current ratchet public key (base64)" })
  @IsString()
  @MaxLength(200)
  dh: string;

  @ApiProperty({ description: 'Previous sending chain length' })
  @IsInt()
  @Min(0)
  pn: number;

  @ApiProperty({ description: 'Message number in the current sending chain' })
  @IsInt()
  @Min(0)
  n: number;

  @ApiPropertyOptional({ description: 'X3DH initial message only' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  identityKey?: string;

  @ApiPropertyOptional({ description: 'X3DH initial message only' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  ephemeralKey?: string;

  @ApiPropertyOptional({ description: 'X3DH initial message only' })
  @IsOptional()
  @IsInt()
  @Min(0)
  oneTimePrekeyId?: number;

  @ApiPropertyOptional({ description: 'X3DH initial message only' })
  @IsOptional()
  @IsInt()
  @Min(0)
  signedPrekeyId?: number;
}
