import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { RequestUser } from '../../common/types/api-response.types';

// handleRequest is protected on AuthGuard; expose it with precise types for tests.
interface GuardWithHandleRequest {
  handleRequest(err: unknown, user: RequestUser | null): RequestUser;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard({
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector);
  });

  it('bypasses the guard for @Public() routes', () => {
    const reflector = guard['reflector'] as jest.Mocked<Reflector>;
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const ctx = {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    expect(guard.canActivate(ctx as unknown as ExecutionContext)).toBe(true);
  });

  it('throws UnauthorizedException on a protected route with no token', () => {
    // Regression: soft-auth override must NOT be present — base AuthGuard throws here.
    expect(() =>
      (guard as unknown as GuardWithHandleRequest).handleRequest(null, null),
    ).toThrow(UnauthorizedException);
  });

  it('propagates passport errors on a protected route', () => {
    const err = new UnauthorizedException('jwt expired');
    expect(() =>
      (guard as unknown as GuardWithHandleRequest).handleRequest(err, null),
    ).toThrow(err);
  });

  it('returns the validated user when authentication succeeds', () => {
    const user: RequestUser = {
      id: 'e7b3f1a2-0000-0000-0000-000000000000',
      role: 'user',
    };
    expect(
      (guard as unknown as GuardWithHandleRequest).handleRequest(null, user),
    ).toBe(user);
  });
});
