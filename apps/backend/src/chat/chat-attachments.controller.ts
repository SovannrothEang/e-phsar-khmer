import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { ChatAttachmentsService } from './chat-attachments.service';
import { CreateAttachmentDto, SignAttachmentsDto } from './dto/attachments.dto';

@ApiTags('chats')
@ApiBearerAuth()
@Controller('chats/attachments')
export class ChatAttachmentsController {
  constructor(private readonly attachments: ChatAttachmentsService) {}

  @Post()
  // Each create reserves storage; cap the rate on top of the daily byte quota.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Reserve an encrypted attachment and get its upload URL',
  })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAttachmentDto) {
    return this.attachments.create(user.id, dto);
  }

  @Post('sign')
  @ApiOperation({
    summary: 'Short-lived download URLs for attachments in my conversations',
  })
  sign(@CurrentUser() user: RequestUser, @Body() dto: SignAttachmentsDto) {
    return this.attachments.sign(user.id, dto.ids);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Confirm the upload finished (verifies the stored size)',
  })
  complete(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attachments.complete(user.id, id);
  }
}
