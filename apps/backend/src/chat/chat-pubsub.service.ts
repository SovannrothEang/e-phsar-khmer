import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export type ChatPushEvent =
  | { targetUserId: string; type: 'message'; payload: unknown }
  | { targetUserId: string; type: 'inbox_update' }
  | { targetUserId: string; type: 'unread_count' };

const CHANNEL = 'chat:push';

/**
 * Cross-instance chat push over Redis pub/sub — reuses the same Redis
 * BullMQ already connects to (see BullModule.forRootAsync in app.module.ts).
 * ConnectionRegistry is a local, per-process Map, so ChatGateway can only
 * write to sockets on its own instance. Routing every push through Redis
 * instead of writing to local sockets directly is what lets a recipient
 * connected to a DIFFERENT backend instance still get realtime delivery — a
 * single-instance deployment still round-trips through Redis, the extra hop
 * is the price of not special-casing "am I the instance that produced this".
 *
 * `message` carries the actual row (the recipient has no other way to get
 * it before their next poll). `inbox_update` / `unread_count` carry no
 * payload on purpose — they are "something changed, refetch" signals, so the
 * client re-runs its existing query functions instead of this layer growing
 * a second serialization of inbox/unread-count shapes to keep in sync.
 */
@Injectable()
export class ChatPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatPubSubService.name);
  private readonly pub: Redis;
  private readonly sub: Redis;
  private handler: ((event: ChatPushEvent) => void) | null = null;

  constructor(private readonly config: ConfigService) {
    const options = {
      host: this.config.get<string>('queue.host') ?? 'localhost',
      port: this.config.get<number>('queue.port') ?? 6379,
      password: this.config.get<string>('queue.password'),
      db: this.config.get<number>('queue.db') ?? 0,
    };
    // Pub/sub needs its own connection — a subscribed ioredis client can't
    // issue other commands — so this is deliberately separate from BullMQ's.
    this.pub = new Redis(options);
    this.sub = new Redis(options);
  }

  async onModuleInit() {
    await this.sub.subscribe(CHANNEL);
    this.sub.on('message', (_channel, raw) => {
      if (!this.handler) return;
      try {
        this.handler(JSON.parse(raw) as ChatPushEvent);
      } catch (err) {
        this.logger.warn(`Dropped malformed chat push payload: ${String(err)}`);
      }
    });
  }

  /** ChatGateway registers the one handler that delivers to local sockets. */
  onEvent(handler: (event: ChatPushEvent) => void) {
    this.handler = handler;
  }

  async publish(event: ChatPushEvent): Promise<void> {
    await this.pub.publish(CHANNEL, JSON.stringify(event));
  }

  async onModuleDestroy() {
    await Promise.all([this.sub.quit(), this.pub.quit()]);
  }
}
