import type { OutboxEventRow } from '../../db/schema/outbox.schema';
import { PaymentPollOutboxHandler } from './payment-poll-outbox-handler';

function makeHandler() {
  const add = jest.fn().mockResolvedValue(undefined);
  const handler = new PaymentPollOutboxHandler(
    { add } as never,
    { register: jest.fn() } as never,
  );
  return { handler, add };
}

function event(payload: Record<string, unknown>): OutboxEventRow {
  return { id: 'evt-1', payload } as unknown as OutboxEventRow;
}

const base = {
  paymentTransactionId: 'tx-1',
  paymentAttemptId: 'att-1',
  intervalMs: 4_000,
  expiresAt: 123,
};

describe('PaymentPollOutboxHandler', () => {
  it('delays the first round by the provider interval', async () => {
    const { handler, add } = makeHandler();

    await expect(handler.handle(event(base))).resolves.toEqual({
      status: 'published',
    });

    expect(add).toHaveBeenCalledWith('poll-attempt', base, {
      delay: 4_000,
      jobId: 'evt-1',
    });
  });

  it('uses the per-round back-off delay when the payload carries one', async () => {
    const { handler, add } = makeHandler();

    await handler.handle(event({ ...base, round: 6, delayMs: 8_000 }));

    expect(add).toHaveBeenCalledWith('poll-attempt', expect.anything(), {
      delay: 8_000,
      jobId: 'evt-1',
    });
  });

  it('asks the outbox to retry when the queue is unreachable', async () => {
    const { handler, add } = makeHandler();
    add.mockRejectedValueOnce(new Error('redis down'));

    await expect(handler.handle(event(base))).resolves.toEqual({
      status: 'retry',
      error: 'redis down',
    });
  });
});
