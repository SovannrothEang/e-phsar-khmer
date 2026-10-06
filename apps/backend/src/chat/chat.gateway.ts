import { IncomingMessage } from 'http';
import { URL } from 'url';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { ValidationError } from 'class-validator';
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
import { SendMessageDto } from './dto/send-message.dto';
import { WS_TICKET_TYP } from './ws-ticket';
import type WebSocket from 'ws';

/** Untrusted client frame — `payload` is validated in onSendMessage. */
interface ClientEnvelope {
  payload?: unknown;
}

interface WsErrorPayload {
  code: string;
  message: string;
  details?: unknown;
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
  private readonly logger = new Logger(ChatGateway.name);

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
      'payload' in event
        ? { type: event.type, payload: event.payload }
        : { type: event.type },
    );
    for (const conn of this.registry.connectionsFor(event.targetUserId)) {
      conn.socket.send(frame);
    }
  }

  async handleConnection(socket: WebSocket, req: IncomingMessage) {
    try {
      // Browser WS API cannot set headers. Four fallbacks:
      // 1. ?ticket= short-lived WS ticket (POST /chats/ws-ticket) — the only
      //    one that works when the backend is on a different origin than the
      //    web app (tunnels, separate API domain): cookies don't cross hosts
      // 2. ?token= query param (explicit)
      // 3. Authorization header (non-browser clients)
      // 4. user_access_token httpOnly cookie (same-host WS upgrades send cookies)
      const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? 'localhost'}`,
      );
      const ticket = url.searchParams.get('ticket');
      const token =
        ticket ??
        url.searchParams.get('token') ??
        this.extractBearerToken(req.headers.authorization) ??
        this.extractCookieToken(req.headers.cookie);

      if (!token) {
        socket.close(4001, 'Missing token');
        return;
      }

      const claims = this.auth.verify<{ sub: string; typ?: string }>(token);
      if (ticket && claims.typ !== WS_TICKET_TYP) {
        socket.close(4001, 'Invalid ticket');
        return;
      }

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
      // HeartbeatService evicts any socket whose lastPongAt is stale; browsers
      // answer protocol-level pings automatically, but only this listener
      // records it. Without it every socket is force-closed ~40s after connect.
      socket.on('pong', () => {
        conn.lastPongAt = Date.now();
      });
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

  /**
   * Every outcome answers with exactly one frame, echoing `clientMessageId`
   * so the client can match it to its optimistic message:
   * - `{ type: 'ack', payload: { clientMessageId, conversationId, message } }`
   * - `{ type: 'error', payload: { clientMessageId, code, message, details? } }`
   *   with the same `code`/`details` the REST envelope would carry (e.g.
   *   E2E_DEVICES_MISMATCH + { missing, stale }).
   *
   * Errors are caught here rather than left to Nest: the global filter is
   * HTTP-only (`switchToHttp().getResponse().status(...)`), so an uncaught
   * throw from a WS handler never reached the client in a usable shape.
   */
  @SubscribeMessage('send_message')
  async onSendMessage(socket: WebSocket, envelope: ClientEnvelope) {
    const conn = this.conns.get(socket);
    if (!conn) return;

    const rawPayload: unknown = envelope?.payload;
    const clientMessageId =
      typeof rawPayload === 'object' &&
      rawPayload !== null &&
      typeof (rawPayload as { clientMessageId?: unknown }).clientMessageId ===
        'string'
        ? (rawPayload as { clientMessageId: string }).clientMessageId
        : null;

    if (!this.checkRateLimit(conn.userId)) {
      this.sendError(socket, clientMessageId, {
        code: 'RATE_LIMITED',
        message: 'Too many messages — slow down.',
      });
      return;
    }

    try {
      const dto = await this.validatePayload(rawPayload);
      // Delivery (to the recipient, plus inbox/unread pushes to both sides)
      // happens inside ChatService.sendMessage via ChatPubSubService — REST
      // and WS sends share that one path instead of duplicating push logic.
      const result = await this.core.sendMessage(conn.userId, dto);
      this.sendFrame(socket, {
        type: 'ack',
        payload: { clientMessageId, ...result },
      });
    } catch (err) {
      this.sendError(socket, clientMessageId, this.toWsError(err));
    }
  }

  /**
   * The global ValidationPipe can't see inside `ClientEnvelope` (an
   * interface — no runtime metatype), so the payload is validated here with
   * the same options main.ts gives REST bodies.
   */
  private async validatePayload(raw: unknown): Promise<SendMessageDto> {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      throw new BadRequestException('Message payload must be an object');
    const dto = plainToInstance(SendMessageDto, raw, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0)
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        details: this.flattenValidationErrors(errors),
      });
    return dto;
  }

  private flattenValidationErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((e) => [
      ...Object.values(e.constraints ?? {}),
      ...this.flattenValidationErrors(e.children ?? []),
    ]);
  }

  /** Same code/message/details mapping as GlobalExceptionFilter. */
  private toWsError(err: unknown): WsErrorPayload {
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse();
      const custom =
        typeof body === 'object' && body !== null
          ? (body as { code?: unknown; message?: unknown; details?: unknown })
          : {};
      const message =
        typeof body === 'string'
          ? body
          : typeof custom.message === 'string'
            ? custom.message
            : err.message;
      return {
        code:
          typeof custom.code === 'string'
            ? custom.code
            : (HttpStatus[status] ?? 'HTTP_ERROR'),
        message,
        ...(custom.details !== undefined ? { details: custom.details } : {}),
      };
    }
    this.logger.error(
      'Unhandled WS send error',
      err instanceof Error ? err.stack : String(err),
    );
    return { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' };
  }

  private sendError(
    socket: WebSocket,
    clientMessageId: string | null,
    error: WsErrorPayload,
  ) {
    this.sendFrame(socket, {
      type: 'error',
      payload: { clientMessageId, ...error },
    });
  }

  private sendFrame(socket: WebSocket, frame: unknown) {
    // The socket may have closed while sendMessage was in flight — the
    // message is still persisted and reaches the client via its catch-up
    // delta on reconnect, so dropping the ack is safe.
    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(frame));
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
