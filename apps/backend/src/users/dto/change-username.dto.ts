import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';

export class ChangeUsernameDto {
  @ApiProperty({ example: 'sok-dara' })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.normalize('NFC').trim() : value,
  )
  @IsString()
  @MaxLength(50)
  @Matches(/^[\p{L}\p{M}\p{N}._-]+$/u, {
    message:
      'username may contain letters (any script), numbers, marks, dot, underscore or dash',
  })
  username: string;
}
