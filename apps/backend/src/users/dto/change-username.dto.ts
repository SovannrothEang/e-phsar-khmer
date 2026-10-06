import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ChangeUsernameDto {
  @ApiProperty({ example: 'sokdara' })
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,50}$/, {
    message: 'username must be 3-50 characters (letters, digits, . _ -)',
  })
  username: string;
}
