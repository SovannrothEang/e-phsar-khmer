import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/api-response.types';
import { E2eKeysService } from './e2e-keys.service';
import {
  HeartbeatDeviceDto,
  RegisterE2eDeviceDto,
} from './dto/register-e2e-device.dto';
import { AddDevicePrekeysDto } from './dto/add-device-prekeys.dto';

/**
 * Multi-device (v2) key directory. Lives beside the v1 `chats/e2e/keys`
 * routes, which stay untouched for stale clients until the Phase 3 cutover
 * (tasks/plan-e2e-multi-device.md).
 */
@ApiTags('chats')
@ApiBearerAuth()
@Controller('chats/e2e')
export class E2eDevicesController {
  constructor(private readonly e2eKeysService: E2eKeysService) {}

  @Post('devices')
  @ApiOperation({
    summary:
      'Register this browser as an E2E device, or claim the existing device with the same identity key',
  })
  registerDevice(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterE2eDeviceDto,
  ) {
    return this.e2eKeysService.registerDevice(user.id, dto);
  }

  @Post('devices/:deviceId/heartbeat')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Keep this device active and report its remaining one-time prekeys (404 = re-register)',
  })
  heartbeat(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: HeartbeatDeviceDto,
  ) {
    return this.e2eKeysService.heartbeatDevice(user.id, deviceId, dto.label);
  }

  @Post('devices/:deviceId/prekeys')
  @ApiOperation({ summary: "Replenish this device's one-time prekeys" })
  addPrekeys(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: AddDevicePrekeysDto,
  ) {
    return this.e2eKeysService.addDevicePrekeys(user.id, deviceId, dto);
  }

  @Get('users/:userId/devices')
  @ApiOperation({
    summary: "A user's active device ids — the set a sender must encrypt to",
  })
  listDevices(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.e2eKeysService.listActiveDevices(user.id, userId);
  }

  @Get('devices/:deviceId/bundle')
  @ApiOperation({
    summary: 'Key bundle for one device (claims one one-time prekey)',
  })
  getBundle(
    @CurrentUser() user: RequestUser,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.e2eKeysService.getDeviceBundle(user.id, deviceId);
  }
}
