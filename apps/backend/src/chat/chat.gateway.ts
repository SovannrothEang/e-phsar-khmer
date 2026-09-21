import { IncomingMessage } from 'http';
import { URL } from 'url';
import { Inject, OnModuleInit } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { users } from '../db/schema/users.schema';
import { ConnectionRegistry } from './connection-registry';
import type { ConnectionInfo } from './connection-registry';
import { ChatService } from './chat.service';
import { ChatPubSubService } from './chat-pubsub.service';
import type { ChatPushEvent } from './chat-pubsub.service';
import type { SendMessageDto } from './dto/send-message.dto';
import type WebSocket from 'ws';

interface ClientEnvelope {
  payload: SendMessageDto;
}

@WebSocketGateway({ path: '/ws/chat' })
export class ChatGateway
  implements
    OnGatewayConnection<WebSocket>,
    OnGatewayDisconnect<WebSocket>,
    OnModuleInit
{
  // Matches the REST route's @Throttle({ limit: 30, ttl: 60_000 }) on
  // POST /chats/messages — the WS send path is the same abuse surface (spam
  // into someone else's inbox) and had no gate at all before this.
  private static readonly SEND_LIMIT = 30;
  private static readonly SEND_WINDOW_MS = 60_000;

  private readonly conns = new WeakMap<WebSocket, ConnectionInfo>();
  private readonly sendTimestamps = new Map<string, number[]>();

  constructor(
    private readonly registry: ConnectionRegistry,
    private readonly auth: JwtService,
    private readonly core: ChatService,
    private readonly pubsub: ChatPubSubService,
    @Inject(DRIZZLE) private readonly db: DbClient,
  ) {}

  onModuleInit() {
    // The one handler ChatPubSubService delivers every chat push through —
    // ChatService publishes on both the REST and WS send paths, so this is
    // what makes REST-originated sends reach a live WS recipient too.
    this.pubsub.onEvent((event) => this.deliverLocal(event));
  }

  private deliverLocal(event: ChatPushEvent) {
    if (!this.registry.isOnline(event.targetUserId)) return;
    const frame = JSON.stringify(
      event.type === 'message'
        ? { type: 'message', payload: event.payload }
        : { type: event.type },
    );
    for (const conn of this.registry.connectionsFor(event.targetUserId)) {
      conn.socket.send(frame);
    }
  }

  async handleConnection(socket: WebSocket, req: IncomingMessage) {
    try {
      // Browser WS API cannot set headers. Three fallbacks:
      // 1. ?token= query param (explicit)
      // 2. Authorization header (non-browser clients)
      // 3. user_access_token httpOnly cookie (same-origin WS upgrades send cookies)
      const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? 'localhost'}`,
      );
      const token =
        url.searchParams.get('token') ??
        this.extractBearerToken(req.headers.authorization) ??
        this.extractCookieToken(req.headers.cookie);

      if (!token) {
        socket.close(4001, 'Missing token');
        return;
      }

      const claims = this.auth.verify<{ sub: string }>(token);

      // Parity with the REST JwtStrategy: signature/expiry alone isn't
      // enough — a soft-deleted user must not keep a working socket until
      // their access token happens to expire.
      const [user] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, claims.sub), isNull(users.deletedAt)))
        .limit(1);
      if (!user) {
        socket.close(4001, 'Invalid session');
        return;
      }

      const conn: ConnectionInfo = {
        socket,
        userId: claims.sub,
        lastPongAt: Date.now(),
      };
      this.conns.set(socket, conn);
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
    const conn = this.conns.get(socket);
    if (conn) this.registry.remove(conn.userId, conn);
  }

  @SubscribeMessage('send_message')
  async onSendMessage(socket: WebSocket, envelope: ClientEnvelope) {
    const conn = this.conns.get(socket);
    if (!conn) return;

    if (!this.checkRateLimit(conn.userId)) {
      socket.send(
        JSON.stringify({
          type: 'error',
          payload: {
            code: 'RATE_LIMITED',
            message: 'Too many messages — slow down.',
          },
        }),
      );
      return;
    }

    // Delivery (to the recipient, plus inbox/unread pushes to both sides)
    // happens inside ChatService.sendMessage via ChatPubSubService — REST and
    // WS sends share that one path instead of duplicating push logic here.
    await this.core.sendMessage(conn.userId, envelope.payload);
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - ChatGateway.SEND_WINDOW_MS;
    const timestamps = (this.sendTimestamps.get(userId) ?? []).filter(
      (t) => t > windowStart,
    );
    if (timestamps.length >= ChatGateway.SEND_LIMIT) {
      this.sendTimestamps.set(userId, timestamps);
      return false;
    }
    timestamps.push(now);
    this.sendTimestamps.set(userId, timestamps);
    return true;
  }
}
