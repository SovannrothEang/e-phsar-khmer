import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminFeedbackService } from './feedback.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/feedback')
export class AdminFeedbackController {
  constructor(private readonly service: AdminFeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'List submitted feedback, newest first' })
  list() {
    return this.service.list();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a feedback entry' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
