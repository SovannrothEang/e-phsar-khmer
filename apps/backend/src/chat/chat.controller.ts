import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryChatsDto } from './dto/query-chats.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';

@ApiTags('chats')
@ApiBearerAuth()
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  // Tighter than the global 100/60s: sending is the one chat verb that pushes
  // content into someone else's inbox, so it is the harassment/spam surface.
  // 30/min is well above human chat cadence and well below bot cadence.
  // Caveat: the global ThrottlerGuard keys on IP, so this is shared by every
  // user behind one NAT — see the follow-up note about a user-id tracker.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a message (creates the conversation on first message)',
  })
  sendMessage(@CurrentUser() user: RequestUser, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my conversations (inbox)' })
  getInbox(@CurrentUser() user: RequestUser, @Query() query: QueryChatsDto) {
    return this.chatService.getInbox(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Total unread messages across all conversations' })
  getUnreadCount(@CurrentUser() user: RequestUser) {
    return this.chatService.getUnreadCount(user.id);
  }

  @Get('with/:userId')
  @ApiOperation({
    summary: 'Resolve the conversation with a specific user (read-only)',
  })
  getConversationWith(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.chatService.getConversationWith(user.id, userId);
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  getMessages(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query() query: QueryMessagesDto,
  ) {
    return this.chatService.getMessages(user.id, conversationId, query);
  }

  @Post(':conversationId/read')
  @ApiOperation({ summary: 'Mark all messages from the other user as read' })
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chatService.markRead(user.id, conversationId);
  }
}
