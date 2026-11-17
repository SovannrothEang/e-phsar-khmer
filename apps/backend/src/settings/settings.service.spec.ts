import { BadRequestException, Logger } from '@nestjs/common';
import { SettingsService } from './settings.service';

/**
 * A minimal Drizzle stand-in. `select().from().where().limit()` resolves to the
 * next entry of `perCall`, so a test states exactly what each read returns —
 * the service issues one query per key (or three for `supportContacts`).
 */
function makeDb(perCall: Array<Array<Record<string, unknown>>> = []) {
  const written: Array<Record<string, unknown>> = [];
  let call = 0;
  const select = jest.fn(() => {
    const rows = perCall[call++] ?? [];
    const chain: Record<string, unknown> = {};
    for (const k of ['from', 'where', 'limit']) chain[k] = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve);
    return chain;
  });
  const db = {
    select,
    insert: jest.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.values = (v: Record<string, unknown>) => {
        written.push(v);
        chain.onConflictDoUpdate = () => chain;
        chain.returning = () =>
          Promise.resolve([{ ...v, updatedAt: new Date() }]);
        return chain;
      };
      return chain;
    }),
  };
  return { db, written };
}

describe('SettingsService', () => {
  it('returns the code default when the row is absent', async () => {
    const { db } = makeDb([[]]);
    const service = new SettingsService(db as never);

    await expect(service.reportAlertThreshold()).resolves.toBe(5);
  });

  it('returns the post-report default of 5 when the row is absent', async () => {
    const { db } = makeDb([[]]);
    const service = new SettingsService(db as never);

    await expect(service.postReportAlertThreshold()).resolves.toBe(5);
  });

  it('returns the stored post-report threshold when it parses', async () => {
    const { db } = makeDb([[{ value: 7 }]]);
    const service = new SettingsService(db as never);

    await expect(service.postReportAlertThreshold()).resolves.toBe(7);
  });

  it('returns every unset contact channel as absent', async () => {
    const { db } = makeDb([[], [], []]);
    const service = new SettingsService(db as never);

    await expect(service.supportContacts()).resolves.toEqual({});
  });

  it('returns the stored value when it parses', async () => {
    const { db } = makeDb([[{ value: 7 }]]);
    const service = new SettingsService(db as never);

    await expect(service.reportAlertThreshold()).resolves.toBe(7);
  });

  it('falls back and warns instead of throwing on an unreadable value', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { db } = makeDb([[{ value: 'not-a-number' }]]);
    const service = new SettingsService(db as never);

    await expect(service.reportAlertThreshold()).resolves.toBe(5);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('drops cleared contact channels from the payload', async () => {
    // email, telegram, phone — read in that order.
    const { db } = makeDb([[{ value: '' }], [{ value: 't.me/psa' }], []]);
    const service = new SettingsService(db as never);

    await expect(service.supportContacts()).resolves.toEqual({
      telegram: 't.me/psa',
    });
  });

  it('rejects an unknown key without writing', async () => {
    const { db, written } = makeDb();
    const service = new SettingsService(db as never);

    await expect(
      service.set('reports.unknown', 1, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(written).toHaveLength(0);
  });

  it('rejects a non-positive threshold', async () => {
    const { db, written } = makeDb();
    const service = new SettingsService(db as never);

    await expect(
      service.set('reports.alert_threshold', 0, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(written).toHaveLength(0);
  });

  it('accepts a valid threshold and records the actor', async () => {
    const { db, written } = makeDb();
    const service = new SettingsService(db as never);

    await service.set('reports.alert_threshold', 4, 'admin-1');

    expect(written[0]).toMatchObject({
      key: 'reports.alert_threshold',
      value: 4,
      updatedById: 'admin-1',
    });
  });
});
