import { type ChatPushEvent, ChatPubSubService } from './chat-pubsub.service';

type MessageHandler = (channel: string, raw: string) => void;

interface ServiceInternals {
  onModuleInit(): void | Promise<void>;
  onEvent(handler: (event: ChatPushEvent) => void): void;
  logger: { warn: (message: string) => void };
  sub: { on: jest.Mock; subscribe: jest.Mock };
}

/** Build the service without its constructor (which opens ioredis clients). */
function makeService(
  sub: ServiceInternals['sub'],
  warn: jest.Mock,
): ServiceInternals {
  const service = Object.create(
    ChatPubSubService.prototype,
  ) as unknown as ServiceInternals;
  service.sub = sub;
  service.logger = { warn };
  return service;
}

function stubSub(subscribe: jest.Mock): {
  sub: ServiceInternals['sub'];
  handlers: MessageHandler[];
} {
  const handlers: MessageHandler[] = [];
  const on = jest.fn((event: string, handler: MessageHandler) => {
    if (event === 'message') handlers.push(handler);
  });
  return { sub: { on, subscribe }, handlers };
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
});
