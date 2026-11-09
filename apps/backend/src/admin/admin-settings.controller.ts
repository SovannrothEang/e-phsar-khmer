import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { SettingsService } from '../settings/settings.service';

export class UpdateSettingDto {
  /**
   * Validated per key by `SettingsService.set` against the key's own zod
   * schema — the key is a path param, so the shape cannot be declared here.
   * `@IsDefined()` only stops a missing body from silently writing `undefined`.
   */
  @IsDefined()
  value!: unknown;
}

/**
 * The runtime policy store. Both staff tiers are named for the same reason as
 * the SMS audit: these are moderation knobs worked by whoever is on the
 * report queue, and `super_admin` does not satisfy `@Roles('admin')` alone.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List runtime settings with defaults merged in' })
  list() {
    return this.service.list();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Set one runtime setting by key' })
  set(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.service.set(key, dto.value, actor.id);
  }
}
