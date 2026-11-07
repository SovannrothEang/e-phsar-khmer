import { ConflictException } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import type WebSocket from 'ws';
import { ConnectionRegistry } from './connection-registry';
import type { ConnectionInfo } from './connection-registry';
import { ChatGateway } from './chat.gateway';
import type { ChatPushEvent } from './chat-pubsub.service';

const RECIPIENT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const ORIGIN = 'https://app.example';
const IAT = 1_700_000_000;

function makeGateway(
  sendMessage: jest.Mock,
  opts: { sessionId?: string | null; sessionActive?: boolean } = {},
) {
  const registry = new ConnectionRegistry();
  const loginDevices = {
    isSessionActive: jest.fn().mockResolvedValue(opts.sessionActive ?? true),
  };
  const gateway = new ChatGateway(
    registry,
    {} as never, // jwt
    { sendMessage } as never,
    { onEvent: jest.fn() } as never,
    loginDevices as never,
    {} as never, // db
    { get: jest.fn().mockReturnValue([ORIGIN]) } as never, // config
  );
  const sent: unknown[] = [];
  const send = jest.fn((raw: string) => sent.push(JSON.parse(raw)));
  const close = jest.fn();
  const socket = {
    OPEN: 1,
    readyState: 1,
    bufferedAmount: 0,
    send,
    close,
  } as unknown as WebSocket;
  // Register the socket as an authenticated connection without running the
  // handshake (which needs a real JWT + DB).
  (
    gateway as unknown as {
      conns: WeakMap<WebSocket, { userId: string; sessionId: string | null }>;
    }
  ).conns.set(socket, {
    userId: 'u1',
    sessionId: opts.sessionId ?? null,
  });
  return { gateway, registry, socket, sent, send, close, loginDevices };
}

describe('ChatGateway.onSendMessage', () => {
  it('acks a valid send with the service result and clientMessageId', async () => {
    const result = { conversationId: 'c1', message: { id: 'm1' } };
    const sendMessage = jest.fn().mockResolvedValue(result);
    const { gateway, socket, sent } = makeGateway(sendMessage);

    await gateway.onSendMessage(socket, {
      payload: { recipientId: RECIPIENT, body: 'hi', clientMessageId: 'k1' },
    });

    expect(sendMessage).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ recipientId: RECIPIENT, body: 'hi' }),
    );
    expect(sent).toEqual([
      { type: 'ack', payload: { clientMessageId: 'k1', ...result } },
    ]);
  });

  it('closes the socket without sending when the session was revoked', async () => {
    const sendMessage = jest.fn();
    const { gateway, socket, sent, close } = makeGateway(sendMessage, {
      sessionId: 'sid-1',
      sessionActive: false,
    });

    await gateway.onSendMessage(socket, {
      payload: { recipientId: RECIPIENT, body: 'hi' },
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(close).toHaveBeenCalledWith(4001, 'Session revoked');
  });

  it('rejects an invalid payload without calling the service', async () => {
    const sendMessage = jest.fn();
    const { gateway, socket, sent } = makeGateway(sendMessage);

    await gateway.onSendMessage(socket, {
      payload: { recipientId: 'not-a-uuid', body: 'hi', clientMessageId: 'k2' },
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sent).toEqual([
      {
        type: 'error',
        payload: expect.objectContaining({
          clientMessageId: 'k2',
          code: 'BAD_REQUEST',
          message: 'Validation failed',
        }) as unknown,
      },
    ]);
  });

  it('rejects unknown fields like REST does (forbidNonWhitelisted)', async () => {
    const sendMessage = jest.fn();
    const { gateway, socket, sent } = makeGateway(sendMessage);

    await gateway.onSendMessage(socket, {
      payload: { recipientId: RECIPIENT, body: 'hi', isAdmin: true },
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sent[0]).toMatchObject({
      type: 'error',
      payload: { code: 'BAD_REQUEST', clientMessageId: null },
    });
  });

  it('rejects a missing payload', async () => {
    const sendMessage = jest.fn();
    const { gateway, socket, sent } = makeGateway(sendMessage);

    await gateway.onSendMessage(socket, {});

    expect(sendMessage).not.toHaveBeenCalled();
    expect(sent[0]).toMatchObject({
      type: 'error',
      payload: { code: 'BAD_REQUEST' },
    });
  });

  it('forwards a coded service error with its details', async () => {
    const sendMessage = jest.fn().mockRejectedValue(
      new ConflictException({
        code: 'E2E_DEVICES_MISMATCH',
        message: 'Device list changed',
        details: { missing: [], stale: ['d9'] },
      }),
    );
    const { gateway, socket, sent } = makeGateway(sendMessage);

    await gateway.onSendMessage(socket, {
      payload: { recipientId: RECIPIENT, body: 'x', clientMessageId: 'k3' },
    });

    expect(sent).toEqual([
      {
        type: 'error',
        payload: {
          clientMessageId: 'k3',
          code: 'E2E_DEVICES_MISMATCH',
          message: 'Device list changed',
          details: { missing: [], stale: ['d9'] },
        },
      },
    ]);
  });

  it('maps an unexpected error to INTERNAL_SERVER_ERROR', async () => {
    const sendMessage = jest.fn().mockRejectedValue(new Error('db down'));
    const { gateway, socket, sent } = makeGateway(sendMessage);
    jest
      .spyOn(
        (gateway as unknown as { logger: { error: () => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);

    await gateway.onSendMessage(socket, {
      payload: { recipientId: RECIPIENT, body: 'x' },
    });

    expect(sent[0]).toEqual({
      type: 'error',
      payload: {
        clientMessageId: null,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
  });

  it('does not write to a socket that closed mid-send', async () => {
    const sendMessage = jest.fn().mockResolvedValue({
      conversationId: 'c1',
      message: { id: 'm1' },
    });
    const { gateway, socket, send } = makeGateway(sendMessage);
    (socket as unknown as { readyState: number }).readyState = 3; // CLOSED

    await gateway.onSendMessage(socket, {
      payload: { recipientId: RECIPIENT, body: 'hi' },
    });

    expect(send).not.toHaveBeenCalled();
  });
});

describe('ChatGateway.deliverLocal', () => {
  function makeConn(
    overrides: {
      readyState?: number;
      bufferedAmount?: number;
      send?: jest.Mock;
    } = {},
  ): ConnectionInfo & { send: jest.Mock; close: jest.Mock } {
    const send = overrides.send ?? jest.fn();
    const close = jest.fn();
    const socket = {
      OPEN: 1,
      readyState: overrides.readyState ?? 1,
      bufferedAmount: overrides.bufferedAmount ?? 0,
      send,
      close,
    } as unknown as WebSocket & { send: jest.Mock; close: jest.Mock };
    return {
      socket,
      userId: USER,
      sessionId: null,
      lastPongAt: Date.now(),
      send,
      close,
    };
  }

  function deliver(gateway: ChatGateway, event: ChatPushEvent) {
    (
      gateway as unknown as {
        deliverLocal: (e: ChatPushEvent) => void;
      }
    ).deliverLocal(event);
  }

  it('skips a dead socket and still delivers to the other tabs', () => {
    const { gateway, registry } = makeGateway(jest.fn());
    const dead = makeConn({ readyState: 3 });
    const healthy = makeConn();
    registry.add(USER, dead);
    registry.add(USER, healthy);

    deliver(gateway, { targetUserId: USER, type: 'inbox_update' });
    expect(dead.send).not.toHaveBeenCalled();
    expect(healthy.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'inbox_update' }),
    );
  });

  it('keeps delivering when one socket send throws', () => {
    const { gateway, registry } = makeGateway(jest.fn());
    const broken = makeConn({
      send: jest.fn(() => {
        throw new Error('socket gone');
      }),
    });
    const healthy = makeConn();
    registry.add(USER, broken);
    registry.add(USER, healthy);
    jest
      .spyOn(
        (gateway as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    deliver(gateway, { targetUserId: USER, type: 'inbox_update' });

    expect(healthy.send).toHaveBeenCalledTimes(1);
    expect(broken.close).toHaveBeenCalledWith(4008, 'Send failed');
  });

  it('evicts a socket over the send-buffer threshold', () => {
    const { gateway, registry } = makeGateway(jest.fn());
    const slow = makeConn({ bufferedAmount: 2_000_000 });
    const healthy = makeConn();
    registry.add(USER, slow);
    registry.add(USER, healthy);

    deliver(gateway, { targetUserId: USER, type: 'inbox_update' });

    expect(slow.send).not.toHaveBeenCalled();
    expect(slow.close).toHaveBeenCalledWith(4008, 'Send buffer exceeded');
    expect(healthy.send).toHaveBeenCalledTimes(1);
    // Evicted: a later push no longer targets the slow socket.
    expect(registry.connectionsFor(USER)).toHaveLength(1);
  });
});

describe('ChatGateway.handleConnection', () => {
  const TICKET = 'ws.ticket.jwt';

  function makeHandshake(
    opts: {
      iat?: number;
      tokensValidAfter?: Date | null;
      claimsTyp?: string;
    } = {},
  ) {
    const registry = new ConnectionRegistry();
    const claims = {
      sub: USER,
      typ: opts.claimsTyp ?? 'ws',
      iat: opts.iat ?? IAT,
    };
    const jwt = { verify: jest.fn().mockReturnValue(claims) };
    const select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              id: USER,
              tokensValidAfter: opts.tokensValidAfter ?? null,
            },
          ]),
        }),
      }),
    });
    const gateway = new ChatGateway(
      registry,
      jwt as never,
      {} as never, // chat service
      { onEvent: jest.fn() } as never,
      { isSessionActive: jest.fn().mockResolvedValue(true) } as never,
      { select } as never,
      { get: jest.fn().mockReturnValue([ORIGIN]) } as never,
    );
    const close = jest.fn();
    const on = jest.fn();
    const socket = {
      OPEN: 1,
      readyState: 1,
      bufferedAmount: 0,
      send: jest.fn(),
      close,
      on,
    } as unknown as WebSocket;
    const req = (url: string, headers: Record<string, string> = {}) =>
      ({ url, headers }) as IncomingMessage;
    return { gateway, registry, jwt, socket, close, on, req };
  }

  it('accepts a valid ticket with no Origin (native client)', async () => {
    const { gateway, registry, socket, close, on, req } = makeHandshake();

    await gateway.handleConnection(socket, req(`/ws/chat?ticket=${TICKET}`));

    expect(close).not.toHaveBeenCalled();
    expect(registry.isOnline(USER)).toBe(true);
    expect(on).toHaveBeenCalledWith('pong', expect.any(Function));
  });

  it('accepts a valid ticket from an allowed Origin', async () => {
    const { gateway, socket, close, req } = makeHandshake();

    await gateway.handleConnection(
      socket,
      req(`/ws/chat?ticket=${TICKET}`, { origin: ORIGIN }),
    );

    expect(close).not.toHaveBeenCalled();
  });

  it('rejects a foreign Origin before verifying the ticket', async () => {
    const { gateway, socket, close, jwt, req } = makeHandshake();

    await gateway.handleConnection(
      socket,
      req(`/ws/chat?ticket=${TICKET}`, { origin: 'https://evil.example' }),
    );

    expect(close).toHaveBeenCalledWith(4001, 'Origin not allowed');
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it('no longer authenticates with a full access token in ?token=', async () => {
    const { gateway, registry, socket, close, jwt, req } = makeHandshake();

    await gateway.handleConnection(socket, req('/ws/chat?token=access.jwt'));

    expect(close).toHaveBeenCalledWith(4001, 'Missing ticket');
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(registry.isOnline(USER)).toBe(false);
  });

  it('rejects an access token passed as a bearer credential', async () => {
    const { gateway, socket, close, jwt, req } = makeHandshake({
      claimsTyp: 'access',
    });

    await gateway.handleConnection(
      socket,
      req('/ws/chat', { authorization: 'Bearer access.jwt' }),
    );

    expect(jwt.verify).toHaveBeenCalledWith('access.jwt');
    expect(close).toHaveBeenCalledWith(4001, 'Invalid ticket');
  });

  it('rejects a ticket minted before the password-reset cutoff', async () => {
    const { gateway, registry, socket, close, req } = makeHandshake({
      iat: IAT,
      tokensValidAfter: new Date((IAT + 60) * 1000),
    });

    await gateway.handleConnection(socket, req(`/ws/chat?ticket=${TICKET}`));

    expect(close).toHaveBeenCalledWith(4001, 'Session revoked');
    expect(registry.isOnline(USER)).toBe(false);
  });

  it('accepts a ticket minted after the cutoff', async () => {
    const { gateway, socket, close, req } = makeHandshake({
      iat: IAT + 60,
      tokensValidAfter: new Date(IAT * 1000),
    });

    await gateway.handleConnection(socket, req(`/ws/chat?ticket=${TICKET}`));

    expect(close).not.toHaveBeenCalled();
  });
});
