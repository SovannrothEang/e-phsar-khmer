import { OutboxWakeupListener } from './outbox-wakeup.listener';
import type { OutboxWorker } from './outbox-worker.service';

describe('OutboxWakeupListener', () => {
  it('bridges the wakeup event to the worker pool', () => {
    const wakeup = jest.fn();
    const worker = { wakeup } as unknown as OutboxWorker;
    const listener = new OutboxWakeupListener(worker);

    listener.handleWakeup();

    expect(wakeup).toHaveBeenCalledTimes(1);
  });
});
