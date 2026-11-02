import { Logger } from '@nestjs/common';
import { PlasGateClient } from './plasgate-client';

function makeConfig(values: Record<string, string> = {}) {
  return {
    get: (key: string) => values[key],
  } as unknown as import('@nestjs/config').ConfigService;
}

describe('PlasGateClient', () => {
  const baseConfig = {
    'sms.privateKey': 'pk_test',
    'sms.secret': 'secret_test',
    'sms.sender': 'TestSender',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports not-configured when any credential is missing', () => {
    const client = new PlasGateClient(makeConfig({}));
    expect(client.isConfigured()).toBe(false);
  });

  it('reports configured when all three credentials are present', () => {
    const client = new PlasGateClient(makeConfig(baseConfig));
    expect(client.isConfigured()).toBe(true);
  });

  it('classifies a 2xx response as sent', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }) as never);
    const client = new PlasGateClient(makeConfig(baseConfig));

    const result = await client.send({ to: '85512345678', content: 'hello' });

    expect(result).toEqual({
      outcome: 'sent',
      providerStatus: 200,
      providerReply: '{"ok":true}',
    });
  });

  it('never logs the key or secret, even on failure', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn');
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    const client = new PlasGateClient(makeConfig(baseConfig));

    await client.send({ to: '85512345678', content: 'hello' });

    for (const call of warnSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(baseConfig['sms.secret']);
      expect(JSON.stringify(call)).not.toContain(baseConfig['sms.privateKey']);
    }
  });

  it('classifies HTTP 429 as retryable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('rate limited', { status: 429 }) as never,
      );
    const client = new PlasGateClient(makeConfig(baseConfig));

    const result = await client.send({ to: '85512345678', content: 'hello' });
    expect(result.outcome).toBe('retry');
    expect(result.providerStatus).toBe(429);
  });

  it('classifies HTTP 500 as retryable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('server error', { status: 500 }) as never,
      );
    const client = new PlasGateClient(makeConfig(baseConfig));

    const result = await client.send({ to: '85512345678', content: 'hello' });
    expect(result.outcome).toBe('retry');
  });

  it('classifies a timeout/network error as retryable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(
        Object.assign(new Error('timeout'), { name: 'AbortError' }),
      );
    const client = new PlasGateClient(makeConfig(baseConfig));

    const result = await client.send({ to: '85512345678', content: 'hello' });
    expect(result.outcome).toBe('retry');
    expect(result.providerReply).toContain('timeout');
  });

  it('classifies a 400 Invalid Sender as a permanent failure', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('Invalid Sender', { status: 400 }) as never,
      );
    const client = new PlasGateClient(makeConfig(baseConfig));

    const result = await client.send({ to: '85512345678', content: 'hello' });
    expect(result.outcome).toBe('failed');
    expect(result.providerStatus).toBe(400);
  });

  it('normalises a local 0-prefixed number to the 855 country code', () => {
    const client = new PlasGateClient(makeConfig(baseConfig));
    expect(client.toInternational('012345678')).toBe('85512345678');
  });

  it('normalises an already-international number unchanged', () => {
    const client = new PlasGateClient(makeConfig(baseConfig));
    expect(client.toInternational('+85512345678')).toBe('85512345678');
  });

  it('returns null for a number too short to be real', () => {
    const client = new PlasGateClient(makeConfig(baseConfig));
    expect(client.toInternational('123')).toBeNull();
  });
});
