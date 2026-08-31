import { Injectable, Logger } from '@nestjs/common';

export interface OutboxDispatchContext {
  /** Outbox row id — safe to use as a downstream idempotency key. */
  id: string;
  topic: string;
  aggregateId: string | null;
  /** 1 on the first delivery attempt. */
  attempt: number;
}

export interface OutboxHandler {
  readonly topic: string;
  handle(
    payload: Record<string, unknown>,
    ctx: OutboxDispatchContext,
  ): Promise<void>;
}

/**
 * Topic -> handler lookup for the dispatcher. Feature modules inject this and
 * call `register()` from their own `onModuleInit`; deliberately a plain Map
 * rather than DI multi-provider tokens or decorator scanning.
 */
@Injectable()
export class OutboxHandlerRegistry {
  private readonly logger = new Logger(OutboxHandlerRegistry.name);
  private readonly handlers = new Map<string, OutboxHandler>();

  register(topic: string, handler: OutboxHandler): void {
    if (this.handlers.has(topic)) {
      throw new Error(
        `An outbox handler is already registered for topic "${topic}"`,
      );
    }
    this.handlers.set(topic, handler);
    this.logger.log(`Registered outbox handler for topic "${topic}"`);
  }

  get(topic: string): OutboxHandler | undefined {
    return this.handlers.get(topic);
  }
}
