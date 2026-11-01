import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  it('returns null when there is no authenticated user', () => {
    const guard = new OptionalJwtAuthGuard();

    expect(guard.handleRequest(new Error('no token'), false)).toBeNull();
  });

  it('passes a validated user through', () => {
    const guard = new OptionalJwtAuthGuard();
    const user = { id: 'user-1', role: 'user' as const };

    expect(guard.handleRequest(null, user)).toBe(user);
  });
});
