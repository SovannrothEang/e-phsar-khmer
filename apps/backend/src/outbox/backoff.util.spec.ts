import { computeBackoffMs } from './backoff.util';

const opts = { baseMs: 1000, factor: 5, maxMs: 900_000 };

describe('computeBackoffMs', () => {
  it('waits the base delay after the first attempt', () => {
    expect(computeBackoffMs(1, opts)).toBe(1000);
  });

  it('grows by the factor on each subsequent attempt', () => {
    expect(computeBackoffMs(2, opts)).toBe(5000);
    expect(computeBackoffMs(3, opts)).toBe(25_000);
    expect(computeBackoffMs(4, opts)).toBe(125_000);
  });

  it('caps at maxMs instead of growing without bound', () => {
    expect(computeBackoffMs(10, opts)).toBe(900_000);
    expect(computeBackoffMs(100, opts)).toBe(900_000);
  });

  it('treats a zero attempt count as the base delay, never negative', () => {
    expect(computeBackoffMs(0, opts)).toBe(1000);
  });
});
