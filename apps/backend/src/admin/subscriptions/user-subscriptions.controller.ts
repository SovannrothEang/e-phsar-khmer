import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserSubscriptionsService } from './user-subscriptions.service';
import { GrantSubscriptionDto } from './dto/grant-subscription.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@UseGuards(RolesGuard)
@Controller('admin/user-subscriptions')
export class UserSubscriptionsController {
  constructor(private readonly service: UserSubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List user subscriptions (joined, with status)' })
  list() {
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Grant a subscription to a user (user + term)' })
  grant(@Body() dto: GrantSubscriptionDto) {
    return this.service.grant(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user subscription' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
