import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { ListReactionsDto } from './dto/list-reactions.dto';
import { ReactionsService } from './reactions.service';

/**
 * The viewer-relative reads: the two list pages and the one batched id-set
 * call that hydrates every card's state. Three-segment `me/*` paths — they
 * cannot collide with the users controller's two-segment `me/*` routes.
 */
@ApiTags('reactions')
@ApiBearerAuth()
@Controller('users')
export class MeReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Get('me/likes')
  @ApiOperation({ summary: 'List listings the current user liked' })
  listMyLikes(
    @CurrentUser() user: RequestUser,
    @Query() query: ListReactionsDto,
  ) {
    return this.reactionsService.listLikedListings(user.id, query);
  }

  @Get('me/saves')
  @ApiOperation({ summary: 'List listings the current user saved' })
  listMySaves(
    @CurrentUser() user: RequestUser,
    @Query() query: ListReactionsDto,
  ) {
    return this.reactionsService.listSavedListings(user.id, query);
  }

  @Get('me/reactions')
  @ApiOperation({
    summary: 'Liked and saved listing ids for the current user',
    description:
      'One batched call so a feed can hydrate every card without an N+1.',
  })
  getMyReactions(@CurrentUser() user: RequestUser) {
    return this.reactionsService.getReactionIds(user.id);
  }
}
