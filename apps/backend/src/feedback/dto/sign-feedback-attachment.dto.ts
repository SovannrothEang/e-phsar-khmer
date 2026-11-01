import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SignFeedbackAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;
}
