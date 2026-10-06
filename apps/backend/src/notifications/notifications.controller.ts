import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications, newest first' })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.list(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count, for the badge' })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications read' })
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of my notifications' })
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.remove(user.id, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all my notifications' })
  removeAll(@CurrentUser() user: RequestUser) {
    return this.notificationsService.removeAll(user.id);
  }
}
