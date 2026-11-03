import { resetProofStillValid } from './password-reset-token';

describe('resetProofStillValid', () => {
  const issuedAt = new Date('2026-11-03T10:00:00.000Z');

  it('accepts a proof when no password change has happened', () => {
    expect(resetProofStillValid(issuedAt, null)).toBe(true);
  });

  it('accepts a proof issued after the last password change', () => {
    expect(
      resetProofStillValid(issuedAt, new Date('2026-11-03T09:59:00.000Z')),
    ).toBe(true);
  });

  it('rejects a proof issued before the last password change — the replay case', () => {
    expect(
      resetProofStillValid(issuedAt, new Date('2026-11-03T10:00:00.500Z')),
    ).toBe(false);
  });

  it('treats the exact cutoff second as usable (JWT iat has second precision)', () => {
    expect(resetProofStillValid(issuedAt, issuedAt)).toBe(true);
  });
});
