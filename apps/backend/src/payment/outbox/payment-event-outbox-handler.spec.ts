import { Logger } from '@nestjs/common';
import type { OutboxEventRow } from '../../db/schema/outbox.schema';
import { PAYMENT_EVENT_JOB } from '../queue/payment-queue.types';
import { PaymentEventOutboxHandler } from './payment-event-outbox-handler';

function event(
  payload: Record<string, unknown>,
  overrides: Partial<OutboxEventRow> = {},
): OutboxEventRow {
  return {
    id: 'outbox-1',
    payload,
    attempts: 1,
    ...overrides,
  } as unknown as OutboxEventRow;
}

function build() {
  const add = jest.fn().mockResolvedValue({});
  const register = jest.fn();
  const handler = new PaymentEventOutboxHandler(
    { add } as never,
    { register } as never,
  );
  return { handler, add, register };
}

describe('PaymentEventOutboxHandler', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers itself so provider-event rows have a handler', () => {
    const { handler, register } = build();

    handler.onModuleInit();

    expect(register).toHaveBeenCalledWith(handler);
  });

  it('publishes a received event under the event id, so dispatcher retries are idempotent', async () => {
    const { handler, add } = build();

    await expect(
      handler.handle(event({ paymentProviderEventId: 'pe-1' })),
    ).resolves.toEqual({ status: 'published' });

    expect(add).toHaveBeenCalledWith(
      PAYMENT_EVENT_JOB,
      { paymentProviderEventId: 'pe-1' },
      { jobId: 'pe-1' },
    );
  });

  it('gives a re-drive its own job id so the dead-lettered job does not swallow it', async () => {
    const { handler, add } = build();
    const payload = { paymentProviderEventId: 'pe-1', redriveAttempt: 2 };

    await handler.handle(event(payload));

    expect(add).toHaveBeenCalledWith(PAYMENT_EVENT_JOB, payload, {
      jobId: 'pe-1-redrive-2',
    });
  });

  it('asks for a retry when the job cannot be published', async () => {
    const { handler, add } = build();
    add.mockRejectedValueOnce(new Error('redis down'));

    await expect(
      handler.handle(event({ paymentProviderEventId: 'pe-1' })),
    ).resolves.toEqual({ status: 'retry', error: 'redis down' });
  });

  it('logs one error with the event id, never the payload, when abandoned', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { handler } = build();

    await handler.onAbandoned(
      event(
        { paymentProviderEventId: 'pe-1', secret: 'webhook-body' },
        {
          attempts: 5,
        },
      ),
      'redis down',
    );

    expect(error).toHaveBeenCalledTimes(1);
    const message = String(error.mock.calls[0][0]);
    expect(message).toContain('outbox-1');
    expect(message).toContain('redis down');
    expect(message).not.toContain('webhook-body');
  });
});
