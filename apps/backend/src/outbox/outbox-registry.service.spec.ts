import { OutboxRegistry } from './outbox-registry.service';
import type { OutboxHandler } from './outbox.types';

function makeHandler(eventType: string): OutboxHandler {
  return {
    eventType,
    handle: () => Promise.resolve({ status: 'published' as const }),
  };
}

describe('OutboxRegistry', () => {
  it('resolves a registered handler by event type', () => {
    const registry = new OutboxRegistry();
    const handler = makeHandler('a.b.c');

    registry.register(handler);

    expect(registry.get('a.b.c')).toBe(handler);
    expect(registry.eventTypes).toEqual(['a.b.c']);
  });

  it('returns undefined for an unknown event type rather than throwing', () => {
    expect(new OutboxRegistry().get('nope')).toBeUndefined();
  });

  it('is idempotent when the same handler registers twice', () => {
    const registry = new OutboxRegistry();
    const handler = makeHandler('a.b.c');

    registry.register(handler);

    expect(() => registry.register(handler)).not.toThrow();
    expect(registry.eventTypes).toHaveLength(1);
  });

  it('rejects a second handler for the same event type', () => {
    const registry = new OutboxRegistry();
    registry.register(makeHandler('a.b.c'));

    expect(() => registry.register(makeHandler('a.b.c'))).toThrow(
      /Two handlers registered/,
    );
  });
});
