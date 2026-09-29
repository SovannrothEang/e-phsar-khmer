import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  ATTACHMENT_KINDS,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_SIGN_MAX_IDS,
} from '../chat-attachments.constants';
import type { AttachmentKind } from '../chat-attachments.constants';

export class CreateAttachmentDto {
  @ApiProperty({
    description:
      'Client-generated UUID. Re-sending the same id returns the same attachment (idempotent create).',
  })
  @IsUUID()
  id: string;

  @ApiProperty({ enum: ATTACHMENT_KINDS })
  @IsIn(ATTACHMENT_KINDS)
  kind: AttachmentKind;

  @ApiProperty({
    description:
      'Encrypted size the client intends to upload. Informational; the real size is read from storage on complete.',
  })
  @IsInt()
  @Min(1)
  @Max(ATTACHMENT_MAX_BYTES.file)
  declaredSize: number;
}

export class SignAttachmentsDto {
  @ApiProperty({ type: [String], maxItems: ATTACHMENT_SIGN_MAX_IDS })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(ATTACHMENT_SIGN_MAX_IDS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
}
