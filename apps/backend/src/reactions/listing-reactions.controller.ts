import { Controller, Delete, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { ReactionsService } from './reactions.service';

/**
 * The per-listing toggles, hung on the listing resource's URL space while the
 * reactions module stays the owner of both tables. Route literals
 * (`like` / `save`) are distinct from every existing `:id/...` route, so
 * registration order cannot shadow them.
 */
@ApiTags('reactions')
@ApiBearerAuth()
@Controller('listings')
export class ListingReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post(':listingId/like')
  @ApiOperation({ summary: 'Like a listing (idempotent)' })
  likeListing(
    @CurrentUser() user: RequestUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.reactionsService.likeListing(user.id, listingId);
  }

  @Delete(':listingId/like')
  @ApiOperation({ summary: 'Unlike a listing (idempotent)' })
  unlikeListing(
    @CurrentUser() user: RequestUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.reactionsService.unlikeListing(user.id, listingId);
  }

  @Post(':listingId/save')
  @ApiOperation({ summary: 'Save a listing (idempotent)' })
  saveListing(
    @CurrentUser() user: RequestUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.reactionsService.saveListing(user.id, listingId);
  }

  @Delete(':listingId/save')
  @ApiOperation({ summary: 'Unsave a listing (idempotent)' })
  unsaveListing(
    @CurrentUser() user: RequestUser,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.reactionsService.unsaveListing(user.id, listingId);
  }
}
