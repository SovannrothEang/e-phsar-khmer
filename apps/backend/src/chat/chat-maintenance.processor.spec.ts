import {
  ATTACHMENTS_CLEANUP_JOB,
  ChatMaintenanceProcessor,
  ChatMaintenanceScheduler,
} from './chat-maintenance.processor';

describe('ChatMaintenanceProcessor', () => {
  it('drains full batches until a short one, then stops', async () => {
    const cleanupOrphans = jest
      .fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(7);
    const processor = new ChatMaintenanceProcessor({
      cleanupOrphans,
    } as never);

    await expect(
      processor.process({ name: ATTACHMENTS_CLEANUP_JOB } as never),
    ).resolves.toEqual({ removed: 207 });
    expect(cleanupOrphans).toHaveBeenCalledTimes(3);
  });

  it('ignores unknown job names', async () => {
    const cleanupOrphans = jest.fn();
    const processor = new ChatMaintenanceProcessor({
      cleanupOrphans,
    } as never);

    await expect(
      processor.process({ name: 'other' } as never),
    ).resolves.toEqual({ removed: 0 });
    expect(cleanupOrphans).not.toHaveBeenCalled();
  });
});

describe('ChatMaintenanceScheduler', () => {
  it('upserts one hourly scheduler and never blocks or throws on boot', async () => {
    const upsertJobScheduler = jest
      .fn()
      .mockRejectedValueOnce(new Error('redis down'));
    const scheduler = new ChatMaintenanceScheduler({
      upsertJobScheduler,
    } as never);

    // Boot must not await the upsert: the shared BullMQ client never rejects
    // while Redis is unreachable, so an await would hang startup forever.
    expect(() => scheduler.onModuleInit()).not.toThrow();
    await new Promise(setImmediate);
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      ATTACHMENTS_CLEANUP_JOB,
      { every: 3_600_000 },
      { name: ATTACHMENTS_CLEANUP_JOB },
    );
  });
});
