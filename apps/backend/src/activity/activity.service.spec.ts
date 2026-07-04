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

  it('is a no-op on the second touch within 5 minutes', () => {
    const db = makeDb();
    const service = makeService(db);

    service.touch('user-1');
    jest.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
    service.touch('user-1');

    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('fires again after 5 minutes have passed', () => {
    const db = makeDb();
    const service = makeService(db);

    service.touch('user-1');
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
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
});
