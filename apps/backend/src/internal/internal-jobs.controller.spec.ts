import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalJobsController } from './internal-jobs.controller';

// Only the class symbols are needed for DI; mocking them keeps this spec off
// the drizzle/Supabase graph.
jest.mock('../outbox/outbox-retention.service', () => ({
  OutboxRetention: class OutboxRetention {},
}));
jest.mock('../users/account-purge.service', () => ({
  AccountPurgeService: class AccountPurgeService {},
}));

// `@nestjs/throttler` is ESM-only under Jest; the decorator is inert here.
jest.mock('@nestjs/throttler', () => ({
  SkipThrottle: () => () => undefined,
}));

const SECRET = 'a-16-char-secret-value';

function setup(values: Record<string, unknown>) {
  const retention = { sweep: jest.fn().mockResolvedValue(7) };
  const purge = { purgeDueAccounts: jest.fn().mockResolvedValue(2) };
  const config = { get: jest.fn((key: string) => values[key]) };
  const controller = new InternalJobsController(
    retention as never,
    purge as never,
    config as never,
  );
  return { controller, retention, purge };
}

describe('InternalJobsController', () => {
  it('fails closed when no secret is configured', async () => {
    const { controller, retention, purge } = setup({});

    await expect(controller.run(SECRET)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(retention.sweep).not.toHaveBeenCalled();
    expect(purge.purgeDueAccounts).not.toHaveBeenCalled();
  });

  it('rejects a missing, empty or wrong secret without running a sweep', async () => {
    const { controller, retention, purge } = setup({
      'internal.secret': SECRET,
    });

    await expect(controller.run(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.run('')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.run('wrong-secret-value')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(retention.sweep).not.toHaveBeenCalled();
    expect(purge.purgeDueAccounts).not.toHaveBeenCalled();
  });

  it('runs both sweeps once and returns what they removed', async () => {
    const { controller, retention, purge } = setup({
      'internal.secret': SECRET,
    });

    await expect(controller.run(SECRET)).resolves.toEqual({
      outboxPurged: 7,
      accountsPurged: 2,
    });
    expect(retention.sweep).toHaveBeenCalledTimes(1);
    expect(purge.purgeDueAccounts).toHaveBeenCalledTimes(1);
  });

  it('runs even when the in-process timers are disabled', async () => {
    // The api role turns the timers off (APP_ROLE=api); the cron route is
    // exactly what should still work there. The controller must not consult
    // the timer flags.
    const { controller, retention, purge } = setup({
      'internal.secret': SECRET,
      'outbox.workerEnabled': false,
      'accounts.purgeEnabled': false,
    });

    await expect(controller.run(SECRET)).resolves.toEqual({
      outboxPurged: 7,
      accountsPurged: 2,
    });
    expect(retention.sweep).toHaveBeenCalledTimes(1);
    expect(purge.purgeDueAccounts).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed purge as a rejected call, so the cron retries', async () => {
    const { controller, purge } = setup({ 'internal.secret': SECRET });
    purge.purgeDueAccounts.mockRejectedValueOnce(new Error('db down'));

    await expect(controller.run(SECRET)).rejects.toThrow('db down');
  });
});
