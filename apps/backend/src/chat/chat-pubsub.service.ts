import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { queueRedisOptions } from '../common/queue/queue-connection';

export type ChatPushEvent =
  | { targetUserId: string; type: 'message'; payload: unknown }
  | { targetUserId: string; type: 'inbox_update' }
  | { targetUserId: string; type: 'unread_count' }
  // The other participant read my messages in `conversationId` — the open
  // thread refetches its delta to pick up the new peerLastReadAt. Without
  // this, a WS-connected sender (whose delta poll is paused) never sees the
  // "seen" tick until focus/reconnect.
  | { targetUserId: string; type: 'read'; payload: { conversationId: string } }
  // A user-facing notification was just created (see
  // RealtimeNotificationChannel) — e.g. `payment.succeeded`, which is what
  // lets the checkout page settle without polling. Not chat-specific: this
  // socket is simply the one realtime connection a signed-in tab holds.
  | {
      targetUserId: string;
      type: 'notification';
      payload: { type: string; data?: Record<string, unknown> };
    };

const CHANNEL = 'chat:push';

/** First retry delay after a failed SUBSCRIBE; doubles up to the cap. */
const RESUBSCRIBE_BASE_MS = 1_000;
const RESUBSCRIBE_MAX_MS = 30_000;

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
  private resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
  private resubscribeAttempt = 0;
  private subscribing = false;
  private degraded = false;
  private destroyed = false;

  constructor(private readonly config: ConfigService) {
    // Pub/sub needs its own connection — a subscribed ioredis client can't
    // issue other commands — so this is deliberately separate from BullMQ's.
    this.pub = new Redis(queueRedisOptions(this.config, 'chat-pub'));
    // A subscriber is a long-lived connection: never let a retry count reject
    // the SUBSCRIBE, and queue commands while ioredis reconnects (the BullMQ
    // client uses the same maxRetriesPerRequest for the same reason). Without
    // this, a Redis outage longer than 20 retries leaves the process silently
    // deaf to chat pushes until it restarts.
    this.sub = new Redis({
      ...queueRedisOptions(this.config, 'chat-sub'),
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });

    // ioredis is an EventEmitter: an 'error' event with no listener is a
    // fatal unhandled exception that crashes the whole process, not just
    // this service — required even though every call site already treats a
    // publish/subscribe failure as non-fatal.
    this.pub.on('error', (err) =>
      this.logger.warn(`Redis pub error: ${String(err)}`),
    );
    this.sub.on('error', (err) =>
      this.logger.warn(`Redis sub error: ${String(err)}`),
    );
  }

  onModuleInit(): void {
    this.sub.on('message', (_channel, raw) => {
      if (!this.handler) return;
      try {
        this.handler(JSON.parse(raw) as ChatPushEvent);
      } catch (err) {
        this.logger.warn(`Dropped malformed chat push payload: ${String(err)}`);
      }
    });

    // Subscribing is a push optimisation, not a boot requirement. ioredis
    // queues the command while disconnected and only rejects after
    // maxRetriesPerRequest — long enough to hold NestFactory.create past a
    // serverless startup deadline, so the app never reaches app.listen and
    // every route answers 503 (Vercel, 2026-11-01). Kick the subscribe off in
    // the background instead: chat falls back to REST polling, and a
    // subscription that lands later still starts delivering.
    //
    // Re-issue on every reconnect event, not only once at boot: ioredis only
    // auto-resubscribes channels it already registered, so a SUBSCRIBE that
    // failed before the connection was up (or was dropped on `end`) would
    // leave this instance permanently deaf while the web client believes the
    // socket is fine.
    this.sub.on('ready', () => this.ensureSubscribed());
    this.sub.on('end', () => this.ensureSubscribed());
    this.sub.on('reconnecting', () => this.ensureSubscribed());
    this.ensureSubscribed();
  }

  /**
   * Idempotent SUBSCRIBE: ioredis returns the subscriber count for an
   * already-subscribed channel, and `subscribing` prevents a burst of
   * reconnect events from stacking commands. A failure schedules one retry
   * with capped exponential backoff and logs once per outage, not per retry.
   */
  private ensureSubscribed(): void {
    if (this.destroyed || this.subscribing) return;
    this.subscribing = true;
    this.sub
      .subscribe(CHANNEL)
      .then(() => {
        this.subscribing = false;
        this.resubscribeAttempt = 0;
        if (this.resubscribeTimer) {
          clearTimeout(this.resubscribeTimer);
          this.resubscribeTimer = null;
        }
        if (this.degraded) {
          this.degraded = false;
          this.logger.log('Chat pub/sub restored: pushes resumed');
        }
      })
      .catch((err: unknown) => {
        this.subscribing = false;
        this.scheduleResubscribe(err);
      });
  }

  private scheduleResubscribe(err: unknown): void {
    if (!this.degraded) {
      this.degraded = true;
      this.logger.warn(
        `Chat pub/sub unavailable (${String(err)}): pushes degrade to polling`,
      );
    }
    if (this.resubscribeTimer) return;
    const attempt = this.resubscribeAttempt ?? 0;
    const delay = Math.min(
      RESUBSCRIBE_BASE_MS * 2 ** attempt,
      RESUBSCRIBE_MAX_MS,
    );
    this.resubscribeAttempt = attempt + 1;
    this.resubscribeTimer = setTimeout(() => {
      this.resubscribeTimer = null;
      this.ensureSubscribed();
    }, delay);
    // Never keep the process (or a test worker) alive for a retry.
    this.resubscribeTimer.unref?.();
  }

  /** ChatGateway registers the one handler that delivers to local sockets. */
  onEvent(handler: (event: ChatPushEvent) => void) {
    this.handler = handler;
  }

  async publish(event: ChatPushEvent): Promise<void> {
    await this.pub.publish(CHANNEL, JSON.stringify(event));
  }

  async onModuleDestroy() {
    this.destroyed = true;
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }
    await Promise.all([this.sub.quit(), this.pub.quit()]);
  }
}
