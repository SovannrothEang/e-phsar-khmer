import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @ApiProperty({
    description: 'Short-lived reset token returned by the verify step',
  })
  @IsString()
  @IsNotEmpty()
  resetToken: string;

  // 72 is bcrypt's input limit — bytes past it are silently ignored, so a
  // longer password would give its owner false confidence.
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
