import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryChatsDto } from './dto/query-chats.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { WS_TICKET_TTL_SECONDS, WS_TICKET_TYP } from './ws-ticket';

@ApiTags('chats')
@ApiBearerAuth()
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly jwt: JwtService,
  ) {}

  @Post('ws-ticket')
  // The WS handshake can't carry the web app's httpOnly `user_access_token`
  // cookie when the backend lives on another origin (ngrok/cloudflare tunnel,
  // separate API domain), and browser WS can't set headers. The web server
  // action fetches this short-lived ticket on the user's behalf and the
  // client passes it as `?ticket=` — the long-lived access token never
  // reaches page JS. `typ: 'ws'` makes JwtStrategy refuse it as a REST bearer.
  @ApiOperation({
    summary: 'Issue a short-lived ticket for the chat WebSocket',
  })
  issueWsTicket(@CurrentUser() user: RequestUser) {
    const ticket = this.jwt.sign(
      { sub: user.id, typ: WS_TICKET_TYP },
      { expiresIn: WS_TICKET_TTL_SECONDS },
    );
    return { ticket, expiresIn: WS_TICKET_TTL_SECONDS };
  }

  @Post('messages')
  // Tighter than the global 100/60s: sending is the one chat verb that pushes
  // content into someone else's inbox, so it is the harassment/spam surface.
  // 30/min is well above human chat cadence and well below bot cadence.
  // Keyed on user id, not IP (UserAwareThrottlerGuard — see app.module.ts),
  // so this can no longer be shared by every user behind one NAT.
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

  @Post('with/:userId')
  @ApiOperation({
    summary: 'Find-or-create the conversation with a specific user',
  })
  startConversation(
    @CurrentUser() user: RequestUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.chatService.startConversation(user.id, userId);
  }

  @Delete(':conversationId')
  @ApiOperation({
    summary: 'Delete (hide) a conversation from my own inbox only',
  })
  deleteConversation(
    @CurrentUser() user: RequestUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.chatService.deleteConversation(user.id, conversationId);
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
