import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

function makeStrategy(rows: unknown[] = []) {
  const db = {
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(rows) }),
      }),
    })),
  };
  const config = { get: jest.fn().mockReturnValue('secret') };
  return { strategy: new JwtStrategy(config as never, db as never), db };
}

describe('JwtStrategy', () => {
  it('rejects a password-reset proof as a bearer', async () => {
    const { strategy } = makeStrategy();

    await expect(
      strategy.validate({ sub: 'u1', role: 'user', typ: 'password_reset' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still accepts a legacy sid-less access token', async () => {
    const { strategy } = makeStrategy([
      { id: 'u1', role: 'user', status: 'active', deletedAt: null },
    ]);

    await expect(
      strategy.validate({ sub: 'u1', role: 'user' }),
    ).resolves.toEqual({ id: 'u1', role: 'user', sessionId: null });
  });
});
