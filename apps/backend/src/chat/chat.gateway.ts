import { IncomingMessage } from 'http';
import { URL } from 'url';
import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConnectionRegistry } from './connection-registry';
import { ChatService } from './chat.service';
import type { SendMessageDto } from './dto/send-message.dto';
import type WebSocket from 'ws';

interface ClientEnvelope {
  payload: SendMessageDto;
}

@WebSocketGateway({ path: '/ws/chat' })
export class ChatGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  constructor(
    private readonly registry: ConnectionRegistry,
    private readonly auth: JwtService,
    private readonly core: ChatService,
  ) {}

  handleConnection(socket: WebSocket, req: IncomingMessage) {
    try {
      // Browser WS API cannot set headers. Three fallbacks:
      // 1. ?token= query param (explicit)
      // 2. Authorization header (non-browser clients)
      // 3. user_access_token httpOnly cookie (same-origin WS upgrades send cookies)
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const token = url.searchParams.get('token')
        ?? this.extractBearerToken(req.headers.authorization)
        ?? this.extractCookieToken(req.headers.cookie);

      if (!token) {
        socket.close(4001, 'Missing token');
        return;
      }

      const claims = this.auth.verify<{ sub: string }>(token);
      const conn = { socket, userId: claims.sub, lastPongAt: Date.now() };
      (socket as any)._conn = conn;
      this.registry.add(claims.sub, conn);
    } catch {
      socket.close(4001, 'Invalid token');
    }
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7);
  }

  private extractCookieToken(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)user_access_token=([^;]+)/);
    return match?.[1] ?? null;
  }

  handleDisconnect(socket: WebSocket) {
    const conn = (socket as any)._conn;
    if (conn) this.registry.remove(conn.userId, conn);
  }

  @SubscribeMessage('send_message')
  async onSendMessage(socket: WebSocket, envelope: ClientEnvelope) {
    const conn = (socket as any)._conn;
    const result = await this.core.sendMessage(conn.userId, envelope.payload);
    const message = result.message;

    const recipientId = envelope.payload.recipientId;
    if (this.registry.isOnline(recipientId)) {
      for (const rc of this.registry.connectionsFor(recipientId)) {
        rc.socket.send(JSON.stringify({ type: 'message', payload: message }));
      }
    }
  }
}
