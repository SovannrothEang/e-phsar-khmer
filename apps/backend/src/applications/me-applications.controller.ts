import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { ApplicationsService } from './applications.service';
import { ListApplicationsDto } from './dto/list-applications.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

/**
 * The viewer-relative reads and the poster's two writes. Four-segment
 * `me/applications/*` paths — they cannot collide with the users controller's
 * two-segment `me/*` routes or its three-segment `me/phones/*` ones.
 */
@ApiTags('applications')
@ApiBearerAuth()
@Controller('users')
export class MeApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('me/applications')
  @ApiOperation({
    summary: 'Applications I sent',
    description:
      'Optional `listingId` narrows the list to one job — how a listing page asks "have I already applied?".',
  })
  listMine(
    @CurrentUser() user: RequestUser,
    @Query() query: ListApplicationsDto,
  ) {
    return this.applications.listMine(user.id, query);
  }

  @Get('me/applications/received')
  @ApiOperation({ summary: 'Applications to my listings' })
  listReceived(
    @CurrentUser() user: RequestUser,
    @Query() query: ListApplicationsDto,
  ) {
    return this.applications.listReceived(user.id, query);
  }

  @Get('me/applications/:id')
  @ApiOperation({ summary: 'One application (applicant or poster)' })
  getOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applications.getOne(user.id, id);
  }

  @Patch('me/applications/:id')
  @ApiOperation({
    summary: 'The poster marks an application viewed/hired/rejected',
  })
  setStatus(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applications.setStatus(user.id, id, dto);
  }

  @Post('me/applications/:id/cv/sign')
  @ApiOperation({ summary: "A short-lived URL for the applicant's CV" })
  signCv(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.applications.signCv(user.id, id);
  }
}
