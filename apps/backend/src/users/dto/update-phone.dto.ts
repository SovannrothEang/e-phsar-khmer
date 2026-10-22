import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * Edits one saved contact number in place. Deliberately field-scoped: the
 * caller can only change `phone`, never `isPrimary`. Promoting a number stays
 * on the existing `…/primary` route, which also syncs the login identifier —
 * the edit-profile form must not do that.
 */
export class UpdatePhoneDto {
  @ApiProperty({ example: '+85512345678' })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;
}
