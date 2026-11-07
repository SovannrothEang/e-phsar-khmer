import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminSmsDeliveriesService } from './admin-sms-deliveries.service';
import { ListSmsDeliveriesDto } from './dto/list-sms-deliveries.dto';

/**
 * The SMS audit trail, read-only. Both staff tiers are named because this is
 * infrastructure evidence (why a code or a payment notice did not arrive), not
 * one tier's mandate — `super_admin` is a governance tier, not a bigger admin
 * tier, so it does not satisfy `@Roles('admin')` on its own.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/sms-deliveries')
export class AdminSmsDeliveriesController {
  constructor(private readonly service: AdminSmsDeliveriesService) {}

  @Get()
  @ApiOperation({
    summary: 'List SMS delivery attempts (offset paged, filterable)',
  })
  list(@Query() query: ListSmsDeliveriesDto) {
    return this.service.list(query);
  }
}
