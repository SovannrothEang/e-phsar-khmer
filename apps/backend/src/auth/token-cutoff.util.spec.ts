import { isIssuedBeforeCutoff } from './token-cutoff.util';

describe('isIssuedBeforeCutoff', () => {
  const cutoff = new Date('2026-11-02T10:00:00.700Z');
  const cutoffSec = Math.floor(cutoff.getTime() / 1000);

  it('accepts everything when the user has no cutoff', () => {
    expect(isIssuedBeforeCutoff(1, null)).toBe(false);
    expect(isIssuedBeforeCutoff(undefined, undefined)).toBe(false);
  });

  it('rejects a token issued in an earlier second', () => {
    expect(isIssuedBeforeCutoff(cutoffSec - 1, cutoff)).toBe(true);
  });

  it('accepts a token issued in the cutoff second or later', () => {
    expect(isIssuedBeforeCutoff(cutoffSec, cutoff)).toBe(false);
    expect(isIssuedBeforeCutoff(cutoffSec + 5, cutoff)).toBe(false);
  });

  it('rejects a token with no iat once a cutoff exists', () => {
    expect(isIssuedBeforeCutoff(undefined, cutoff)).toBe(true);
  });
});
