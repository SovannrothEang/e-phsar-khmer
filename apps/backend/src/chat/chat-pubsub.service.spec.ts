import { type ChatPushEvent, ChatPubSubService } from './chat-pubsub.service';

type MessageHandler = (channel: string, raw: string) => void;
type LifecycleHandler = (...args: unknown[]) => void;

interface ServiceInternals {
  onModuleInit(): void;
  onEvent(handler: (event: ChatPushEvent) => void): void;
  logger: { warn: (message: string) => void; log: (message: string) => void };
  sub: { on: jest.Mock; subscribe: jest.Mock };
  resubscribeTimer: ReturnType<typeof setTimeout> | null;
  resubscribeAttempt: number;
  subscribing: boolean;
  degraded: boolean;
  destroyed: boolean;
}

/** Build the service without its constructor (which opens ioredis clients). */
function makeService(
  sub: ServiceInternals['sub'],
  warn: jest.Mock,
  log: jest.Mock = jest.fn(),
): ServiceInternals {
  const service = Object.create(
    ChatPubSubService.prototype,
  ) as unknown as ServiceInternals;
  service.sub = sub;
  service.logger = { warn, log };
  service.resubscribeTimer = null;
  service.resubscribeAttempt = 0;
  service.subscribing = false;
  service.degraded = false;
  service.destroyed = false;
  return service;
}

function stubSub(subscribe: jest.Mock): {
  sub: ServiceInternals['sub'];
  handlers: MessageHandler[];
  events: Map<string, LifecycleHandler>;
} {
  const handlers: MessageHandler[] = [];
  const events = new Map<string, LifecycleHandler>();
  const on = jest.fn((event: string, handler: LifecycleHandler) => {
    events.set(event, handler);
    if (event === 'message') handlers.push(handler as MessageHandler);
  });
  return { sub: { on, subscribe }, handlers, events };
}

describe('ChatPubSubService boot', () => {
  it('boots when Redis is unreachable and warns instead of throwing', async () => {
    const warn = jest.fn();
    const { sub } = stubSub(
      jest.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379')),
    );
    const service = makeService(sub, warn);

    expect(() => service.onModuleInit()).not.toThrow();
    await new Promise(setImmediate);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Chat pub/sub unavailable'),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    if (service.resubscribeTimer) clearTimeout(service.resubscribeTimer);
  });

  it('dispatches pushed events to the registered handler', () => {
    const warn = jest.fn();
    const { sub, handlers } = stubSub(jest.fn().mockResolvedValue(1));
    const service = makeService(sub, warn);
    const received: ChatPushEvent[] = [];
    service.onEvent((event) => received.push(event));

    service.onModuleInit();
    expect(handlers).toHaveLength(1);
    handlers[0](
      'chat:push',
      JSON.stringify({ targetUserId: 'u1', type: 'inbox_update' }),
    );

    expect(received).toEqual([{ targetUserId: 'u1', type: 'inbox_update' }]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('drops a malformed payload without throwing', () => {
    const warn = jest.fn();
    const { sub, handlers } = stubSub(jest.fn().mockResolvedValue(1));
    const service = makeService(sub, warn);
    service.onEvent(() => {
      throw new Error('should not run');
    });

    service.onModuleInit();
    expect(() => handlers[0]('chat:push', 'not json')).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropped malformed chat push payload'),
    );
  });

  it('does nothing when no handler is registered yet', () => {
    const warn = jest.fn();
    const { sub, handlers } = stubSub(jest.fn().mockResolvedValue(1));
    const service = makeService(sub, warn);

    service.onModuleInit();
    expect(() =>
      handlers[0](
        'chat:push',
        JSON.stringify({ targetUserId: 'u1', type: 'inbox_update' }),
      ),
    ).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('re-subscribes when the Redis connection ends', async () => {
    const warn = jest.fn();
    const subscribe = jest.fn().mockResolvedValue(1);
    const { sub, events } = stubSub(subscribe);
    const service = makeService(sub, warn);

    service.onModuleInit();
    await new Promise(setImmediate);
    expect(subscribe).toHaveBeenCalledTimes(1);

    events.get('end')?.();

    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(subscribe).toHaveBeenCalledWith('chat:push');
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs one warning across repeated reconnect failures', async () => {
    const warn = jest.fn();
    const subscribe = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { sub, events } = stubSub(subscribe);
    const service = makeService(sub, warn);

    service.onModuleInit();
    await new Promise(setImmediate);
    expect(warn).toHaveBeenCalledTimes(1);

    // Another reconnect event while still unavailable: retried, not re-logged.
    events.get('reconnecting')?.();
    await new Promise(setImmediate);

    expect(subscribe.mock.calls.length).toBeGreaterThan(1);
    expect(warn).toHaveBeenCalledTimes(1);
    if (service.resubscribeTimer) clearTimeout(service.resubscribeTimer);
  });
});
