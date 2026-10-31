import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

/**
 * Applying to a job, hung on the listing's URL space the way the reactions
 * module hangs its toggles there — `applications` is a new literal, so it
 * cannot shadow `:id/publish` or any other listing route.
 *
 * The throttle is not decoration: this route writes a chat message in-process,
 * and `ChatService.sendMessage` called as a method runs no controller guard, so
 * without this the apply path would be an unthrottled door into the chat write.
 */
@ApiTags('applications')
@ApiBearerAuth()
@Controller('listings')
export class ListingApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post(':listingId/applications')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Apply to a job listing' })
  apply(
    @CurrentUser() user: RequestUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applications.apply(user.id, listingId, dto);
  }
}
