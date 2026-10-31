import { ConflictException } from '@nestjs/common';
import type WebSocket from 'ws';
import { ChatGateway } from './chat.gateway';

const RECIPIENT = '11111111-1111-4111-8111-111111111111';

function makeGateway(
  sendMessage: jest.Mock,
  opts: { sessionId?: string | null; sessionActive?: boolean } = {},
) {
  const loginDevices = {
    isSessionActive: jest.fn().mockResolvedValue(opts.sessionActive ?? true),
  };
  const gateway = new ChatGateway(
    {} as never, // registry
    {} as never, // jwt
    { sendMessage } as never,
    { onEvent: jest.fn() } as never,
    loginDevices as never,
    {} as never, // db
  );
  const sent: unknown[] = [];
  const send = jest.fn((raw: string) => sent.push(JSON.parse(raw)));
  const close = jest.fn();
  const socket = {
    OPEN: 1,
    readyState: 1,
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
  return { gateway, socket, sent, send, close, loginDevices };
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
