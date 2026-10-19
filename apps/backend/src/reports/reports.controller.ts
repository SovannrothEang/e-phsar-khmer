import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportReasonsDto } from './dto/list-report-reasons.dto';
import { ReportSubmissionService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportSubmissionsController {
  constructor(private readonly service: ReportSubmissionService) {}

  // Public: the dialogs render the picklist before a session exists; the
  // submit itself is what requires a login.
  @Get('reasons')
  @Public()
  @ApiOperation({ summary: 'List active report reasons for a target type' })
  listReasons(@Query() query: ListReportReasonsDto) {
    return this.service.listReasons(query.targetType);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Report a listing or a user' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateReportDto) {
    return this.service.create(user.id, dto);
  }
}
