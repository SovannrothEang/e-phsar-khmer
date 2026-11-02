import { Logger } from '@nestjs/common';
import { LoginDevicesService } from './login-devices.service';

type Row = Record<string, unknown>;

function makeDb() {
  return {
    insert: jest.fn(),
    update: jest.fn(),
    select: jest.fn(),
  };
}

function makeNotifications() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

function makeService() {
  const db = makeDb();
  const notifications = makeNotifications();
  const service = new LoginDevicesService(db as never, notifications as never);
  return { db, notifications, service };
}

/** `select(...).from(...).where(...)` supports await, `.limit` and `.orderBy`. */
function selectChain(rows: Row[]) {
  const terminal = Promise.resolve(rows) as Promise<Row[]> & {
    limit: () => Promise<Row[]>;
    orderBy: () => { limit: () => Promise<Row[]> };
  };
  terminal.limit = () => Promise.resolve(rows);
  terminal.orderBy = () => ({
    limit: () => Promise.resolve(rows),
  });
  return { from: () => ({ where: () => terminal }) };
}

/** `update(...).set(...).where(...)` is awaitable and exposes `.returning`. */
function updateChain(rows: Row[], onSet?: (data: Row) => void) {
  const terminal = Promise.resolve(rows) as Promise<Row[]> & {
    returning: () => Promise<Row[]>;
  };
  terminal.returning = () => Promise.resolve(rows);
  return {
    set: (data: Row) => {
      onSet?.(data);
      return { where: () => terminal };
    },
  };
}

/** `insert(...).values(...).onConflictDoNothing(...).returning(...)`. */
function insertChain(rows: Row[], onValues?: (data: Row) => void) {
  return {
    values: (data: Row) => {
      onValues?.(data);
      return {
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve(rows),
        }),
      };
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURRENT = { sessionId: null, deviceId: null };

describe('LoginDevicesService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordLogin', () => {
    it('does nothing when the request carried no device', async () => {
      const { db, notifications, service } = makeService();

      await expect(service.recordLogin('user-1', null)).resolves.toEqual({
        isNewDevice: false,
        sessionId: null,
      });

      expect(db.insert).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
      expect(db.select).not.toHaveBeenCalled();
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('reuses the stored session id for a known device', async () => {
      const { db, notifications, service } = makeService();
      let setData: Row = {};
      db.insert.mockReturnValue(insertChain([]));
      db.update.mockReturnValue(
        updateChain([{ sessionId: 'sid-1' }], (data) => {
          setData = data;
        }),
      );

      await expect(
        service.recordLogin('user-1', {
          id: 'device-12345678',
          name: 'Chrome on Linux',
        }),
      ).resolves.toEqual({ isNewDevice: false, sessionId: 'sid-1' });

      expect(setData).toMatchObject({
        lastSeenAt: expect.any(Date) as unknown as Date,
        revokedAt: null,
        deviceName: 'Chrome on Linux',
      });
      expect(setData).not.toHaveProperty('sessionId');
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('does not overwrite a stored name when the client sends none', async () => {
      const { db, service } = makeService();
      let setData: Row = {};
      db.insert.mockReturnValue(insertChain([]));
      db.update.mockReturnValue(
        updateChain([{ sessionId: 'sid-1' }], (data) => {
          setData = data;
        }),
      );

      await service.recordLogin('user-1', {
        id: 'device-12345678',
        name: null,
      });

      expect(setData).not.toHaveProperty('deviceName');
    });

    it('stores the rich metadata it was given', async () => {
      const { db, service } = makeService();
      let values: Row = {};
      db.insert.mockReturnValue(
        insertChain([{ id: 'row-1' }], (data) => {
          values = data;
        }),
      );
      db.select.mockReturnValue(selectChain([{ value: 1 }]));

      await service.recordLogin('user-1', {
        id: 'device-12345678',
        name: 'Chrome 154',
        type: 'browser',
        clientVersion: '2026.10.20',
        browserName: 'Chrome',
        browserVersion: '154.0.0.0',
        osName: 'Linux',
        model: null,
        userAgent: 'ua',
      });

      expect(values).toMatchObject({
        userId: 'user-1',
        deviceId: 'device-12345678',
        deviceName: 'Chrome 154',
        clientType: 'browser',
        clientVersion: '2026.10.20',
        browserName: 'Chrome',
        browserVersion: '154.0.0.0',
        osName: 'Linux',
        userAgent: 'ua',
      });
    });

    it('notifies when a new device appears after the first baseline', async () => {
      const { db, notifications, service } = makeService();
      db.insert.mockReturnValue(insertChain([{ id: 'device-row-1' }]));
      db.select.mockReturnValue(selectChain([{ value: 2 }]));

      const result = await service.recordLogin('user-1', {
        id: 'device-12345678',
        name: 'Chrome on Linux',
      });

      expect(result.isNewDevice).toBe(true);
      expect(result.sessionId).toMatch(UUID);
      expect(notifications.notify).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'security.new_login',
        title: 'New device login',
        body: "Chrome on Linux signed in to your account. If this wasn't you, change your password in Settings.",
        data: {
          deviceId: 'device-12345678',
          deviceName: 'Chrome on Linux',
          loggedInAt: expect.any(String) as unknown as string,
        },
      });
    });

    it('stays silent for the first device an account ever records', async () => {
      const { db, notifications, service } = makeService();
      db.insert.mockReturnValue(insertChain([{ id: 'device-row-1' }]));
      db.select.mockReturnValue(selectChain([{ value: 1 }]));

      const result = await service.recordLogin('user-1', {
        id: 'device-12345678',
        name: 'Chrome on Linux',
      });

      expect(result.isNewDevice).toBe(false);
      expect(result.sessionId).toMatch(UUID);
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('still reports a new device when the notification write fails', async () => {
      const { db, notifications, service } = makeService();
      db.insert.mockReturnValue(insertChain([{ id: 'device-row-1' }]));
      db.select.mockReturnValue(selectChain([{ value: 2 }]));
      notifications.notify.mockRejectedValue(new Error('feed down'));

      const result = await service.recordLogin('user-1', {
        id: 'device-12345678',
        name: 'Chrome on Linux',
      });

      expect(result.isNewDevice).toBe(true);
      expect(result.sessionId).toMatch(UUID);
    });

    it('keeps the session id when the baseline count query fails', async () => {
      const { db, notifications, service } = makeService();
      db.insert.mockReturnValue(insertChain([{ id: 'device-row-1' }]));
      db.select.mockImplementation(() => {
        throw new Error('count down');
      });

      const result = await service.recordLogin('user-1', {
        id: 'device-12345678',
        name: 'Chrome on Linux',
      });

      expect(result.isNewDevice).toBe(false);
      expect(result.sessionId).toMatch(UUID);
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('swallows insert failures so the login still succeeds', async () => {
      const { db, service } = makeService();
      db.insert.mockImplementation(() => {
        throw new Error('db down');
      });

      await expect(
        service.recordLogin('user-1', {
          id: 'device-12345678',
          name: 'Chrome on Linux',
        }),
      ).resolves.toEqual({ isNewDevice: false, sessionId: null });
    });

    it('falls back to "Unknown device" for a blank name', async () => {
      const { db, notifications, service } = makeService();
      db.insert.mockReturnValue(insertChain([{ id: 'device-row-1' }]));
      db.select.mockReturnValue(selectChain([{ value: 2 }]));

      await service.recordLogin('user-1', {
        id: 'device-12345678',
        name: '   ',
      });

      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(
            'Unknown device signed in',
          ) as unknown as string,
        }),
      );
    });
  });

  describe('listActive', () => {
    const rows = [
      {
        id: 'row-1',
        deviceName: 'Chrome 154',
        clientType: 'browser',
        clientVersion: '2026.10.20',
        browserName: 'Chrome',
        browserVersion: '154.0.0.0',
        osName: 'Linux',
        osVersion: null,
        deviceModel: null,
        firstSeenAt: new Date('2026-10-01T00:00:00Z'),
        lastSeenAt: new Date('2026-10-20T00:00:00Z'),
      },
      {
        id: 'row-2',
        deviceName: null,
        clientType: 'tablet',
        clientVersion: null,
        browserName: null,
        browserVersion: null,
        osName: null,
        osVersion: null,
        deviceModel: null,
        firstSeenAt: new Date('2026-09-01T00:00:00Z'),
        lastSeenAt: new Date('2026-09-02T00:00:00Z'),
      },
    ];

    it('marks the row behind the JWT session and touches it', async () => {
      const { db, service } = makeService();
      db.select
        .mockReturnValueOnce(selectChain([{ id: 'row-1' }]))
        .mockReturnValueOnce(selectChain(rows));
      db.update.mockReturnValue(updateChain([]));

      const result = await service.listActive('user-1', {
        sessionId: 'sid-1',
        deviceId: null,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'row-1',
        name: 'Chrome 154',
        clientType: 'browser',
        isCurrent: true,
      });
      expect(result[1]).toMatchObject({
        id: 'row-2',
        name: 'Unknown',
        clientType: null,
        isCurrent: false,
      });
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('falls back to the device id for a legacy session', async () => {
      const { db, service } = makeService();
      db.select
        .mockReturnValueOnce(selectChain([{ id: 'row-2' }]))
        .mockReturnValueOnce(selectChain(rows));
      db.update.mockReturnValue(updateChain([]));

      const result = await service.listActive('user-1', {
        sessionId: null,
        deviceId: 'device-87654321',
      });

      expect(result[1].isCurrent).toBe(true);
    });

    it('still lists when the heartbeat touch fails', async () => {
      const { db, service } = makeService();
      db.select
        .mockReturnValueOnce(selectChain([{ id: 'row-1' }]))
        .mockReturnValueOnce(selectChain(rows));
      db.update.mockImplementation(() => {
        throw new Error('touch down');
      });

      await expect(
        service.listActive('user-1', { sessionId: 'sid-1', deviceId: null }),
      ).resolves.toHaveLength(2);
    });
  });

  describe('revocation', () => {
    it('404s for a missing or foreign device', async () => {
      const { db, service } = makeService();
      db.select.mockReturnValue(selectChain([]));

      await expect(
        service.revoke('user-1', 'row-9', CURRENT),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('refuses to revoke the current device', async () => {
      const { db, service } = makeService();
      db.select
        .mockReturnValueOnce(selectChain([{ id: 'row-1', revokedAt: null }]))
        .mockReturnValueOnce(selectChain([{ id: 'row-1' }]));

      await expect(
        service.revoke('user-1', 'row-1', {
          sessionId: 'sid-1',
          deviceId: null,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('revokes another device and rotates its session id', async () => {
      const { db, service } = makeService();
      let setData: Row = {};
      db.select
        .mockReturnValueOnce(selectChain([{ id: 'row-2', revokedAt: null }]))
        .mockReturnValueOnce(selectChain([{ id: 'row-1' }]));
      db.update.mockReturnValue(
        updateChain([{ id: 'row-2' }], (data) => {
          setData = data;
        }),
      );

      await expect(
        service.revoke('user-1', 'row-2', {
          sessionId: 'sid-1',
          deviceId: null,
        }),
      ).resolves.toEqual({ revoked: 1 });
      expect(setData).toMatchObject({
        revokedAt: expect.any(Date) as unknown as Date,
      });
      expect(setData).toHaveProperty('sessionId');
    });

    it('is idempotent for an already-revoked device', async () => {
      const { db, service } = makeService();
      db.select.mockReturnValueOnce(
        selectChain([{ id: 'row-2', revokedAt: new Date() }]),
      );

      await expect(service.revoke('user-1', 'row-2', CURRENT)).resolves.toEqual(
        { revoked: 0 },
      );
      expect(db.update).not.toHaveBeenCalled();
    });

    it('revokes every active device of the user and rotates their sids', async () => {
      const { db, service } = makeService();
      let setData: Row = {};
      db.update.mockReturnValue(
        updateChain([{ id: 'a' }, { id: 'b' }, { id: 'c' }], (data) => {
          setData = data;
        }),
      );

      await expect(service.revokeAll('user-1')).resolves.toEqual({
        revoked: 3,
      });
      expect(setData).toMatchObject({
        revokedAt: expect.any(Date) as unknown as Date,
      });
      expect(setData).toHaveProperty('sessionId');
    });

    it('requires a current row to revoke others', async () => {
      const { db, service } = makeService();
      db.select.mockReturnValue(selectChain([]));

      await expect(
        service.revokeOthers('user-1', { sessionId: 'sid-1', deviceId: null }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('revokes every other active row', async () => {
      const { db, service } = makeService();
      db.select.mockReturnValue(selectChain([{ id: 'row-1' }]));
      db.update.mockReturnValue(
        updateChain([{ id: 'row-2' }, { id: 'row-3' }]),
      );

      await expect(
        service.revokeOthers('user-1', {
          sessionId: 'sid-1',
          deviceId: null,
        }),
      ).resolves.toEqual({ revoked: 2 });
    });

    it('logout is a no-op without a session id', async () => {
      const { db, service } = makeService();

      await expect(service.revokeSession('user-1', null)).resolves.toEqual({
        revoked: 0,
      });
      expect(db.update).not.toHaveBeenCalled();
    });

    it('logout revokes the current session and swallows failures', async () => {
      const { db, service } = makeService();
      db.update.mockReturnValueOnce(updateChain([{ id: 'row-1' }]));
      await expect(service.revokeSession('user-1', 'sid-1')).resolves.toEqual({
        revoked: 1,
      });

      db.update.mockImplementationOnce(() => {
        throw new Error('db down');
      });
      await expect(service.revokeSession('user-1', 'sid-1')).resolves.toEqual({
        revoked: 0,
      });
    });
  });

  describe('session lookups', () => {
    it('findSessionByDeviceId returns the row including revoked state', async () => {
      const { db, service } = makeService();
      db.select.mockReturnValue(
        selectChain([{ sessionId: 'sid-1', revokedAt: null }]),
      );

      await expect(
        service.findSessionByDeviceId('user-1', 'device-12345678'),
      ).resolves.toEqual({ sessionId: 'sid-1', revokedAt: null });
    });

    it('touchActiveSession reports whether an active row matched', async () => {
      const { db, service } = makeService();
      db.update.mockReturnValueOnce(updateChain([{ id: 'row-1' }]));
      await expect(service.touchActiveSession('user-1', 'sid-1')).resolves.toBe(
        true,
      );

      db.update.mockReturnValueOnce(updateChain([]));
      await expect(service.touchActiveSession('user-1', 'sid-1')).resolves.toBe(
        false,
      );
    });

    it('isSessionActive is true only for an active row', async () => {
      const { db, service } = makeService();
      db.select.mockReturnValueOnce(selectChain([{ id: 'row-1' }]));
      await expect(service.isSessionActive('user-1', 'sid-1')).resolves.toBe(
        true,
      );

      db.select.mockReturnValueOnce(selectChain([]));
      await expect(service.isSessionActive('user-1', 'sid-1')).resolves.toBe(
        false,
      );
    });
  });
});
