import { Logger } from '@nestjs/common';
import { ActivityService } from './activity.service';

function makeDb() {
  const updateWhere = jest.fn().mockResolvedValue([]);
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const update = jest.fn().mockReturnValue({ set: updateSet });
  return { update, updateSet, updateWhere };
}

function makeService(db: { update: jest.Mock }) {
  const service = new ActivityService(db as never);
  return service;
}

describe('ActivityService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires a DB update on the first touch', () => {
    const db = makeDb();
    const service = makeService(db);

    service.touch('user-1');

    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('is a no-op on the second touch within 60 seconds', () => {
    const db = makeDb();
    const service = makeService(db);

    service.touch('user-1');
    jest.advanceTimersByTime(59 * 1000);
    service.touch('user-1');

    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('fires again after 60 seconds have passed', () => {
    const db = makeDb();
    const service = makeService(db);

    service.touch('user-1');
    jest.advanceTimersByTime(60 * 1000 + 1);
    service.touch('user-1');

    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('tracks different users independently', () => {
    const db = makeDb();
    const service = makeService(db);

    service.touch('user-1');
    service.touch('user-2');

    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it('swallows a failed write instead of leaving an unhandled rejection', async () => {
    const db = makeDb();
    db.updateWhere.mockRejectedValueOnce(new Error('db down'));
    const service = makeService(db);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    service.touch('user-1');
    // Let the rejection propagate through the promise chain into the catch.
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('last_seen_at update failed'),
    );
    warn.mockRestore();
  });
});
