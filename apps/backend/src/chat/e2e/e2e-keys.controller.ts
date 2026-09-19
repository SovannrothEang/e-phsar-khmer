import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/api-response.types';
import { E2eKeysService } from './e2e-keys.service';
import { RegisterE2eKeysDto } from './dto/register-e2e-keys.dto';

@ApiTags('chats')
@ApiBearerAuth()
@Controller('chats/e2e/keys')
export class E2eKeysController {
  constructor(private readonly e2eKeysService: E2eKeysService) {}

  @Post()
  @ApiOperation({ summary: "Register or rotate this account's E2E keys" })
  registerKeys(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterE2eKeysDto,
  ) {
    return this.e2eKeysService.registerKeys(user.id, dto);
  }

  @Get('me/prekey-count')
  @ApiOperation({ summary: 'Remaining one-time prekeys for replenishment' })
  getPrekeyCount(@CurrentUser() user: RequestUser) {
    return this.e2eKeysService.getPrekeyCount(user.id);
  }

  @Get(':userId/bundle')
  @ApiOperation({ summary: 'Fetch a key bundle to start an X3DH session' })
  getBundle(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.e2eKeysService.getBundle(userId);
  }
}
