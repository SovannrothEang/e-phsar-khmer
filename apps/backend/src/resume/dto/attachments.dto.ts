import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { RESUME_ATTACHMENT_MAX_BYTES } from '../resume-attachments.constants';

export class CreateResumeAttachmentDto {
  @ApiProperty({
    description:
      'Client-generated UUID. Re-sending the same id returns the same attachment (idempotent create).',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description:
      'Display name, and the trailing segment of the object key the browser saves the download as.',
  })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    description:
      'Size the client intends to upload. Informational — the real size is read from storage on complete.',
  })
  @IsInt()
  @Min(1)
  @Max(RESUME_ATTACHMENT_MAX_BYTES)
  declaredSize: number;
}
