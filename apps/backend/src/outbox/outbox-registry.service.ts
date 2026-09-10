import { Injectable, Logger } from '@nestjs/common';
import type { OutboxHandler } from './outbox.types';

/**
 * Maps an event type to the handler that consumes it.
 *
 * Handlers register themselves from their own module's `onModuleInit`
 * rather than being constructor-injected here. The outbox is generic
 * infrastructure, and naming its consumers here would point the dependency
 * the wrong way — every future producer would have to edit this file.
 */
@Injectable()
export class OutboxRegistry {
  private readonly logger = new Logger(OutboxRegistry.name);
  private readonly handlers = new Map<string, OutboxHandler>();

  register(handler: OutboxHandler): void {
    const existing = this.handlers.get(handler.eventType);
    if (existing && existing !== handler) {
      throw new Error(
        `Two handlers registered for outbox event type: ${handler.eventType}`,
      );
    }
    this.handlers.set(handler.eventType, handler);
    this.logger.log(`Registered handler for ${handler.eventType}`);
  }

  get(eventType: string): OutboxHandler | undefined {
    return this.handlers.get(eventType);
  }

  get eventTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
