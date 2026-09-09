import { toPaymentAttemptOutcome } from './aba-payway.status';

describe('toPaymentAttemptOutcome', () => {
  it('maps payment_status_code 0 to succeeded regardless of text', () => {
    expect(toPaymentAttemptOutcome(0, 'anything')).toBe('succeeded');
    expect(toPaymentAttemptOutcome(0, null)).toBe('succeeded');
  });

  it('maps approved text statuses to succeeded when no code is present', () => {
    expect(toPaymentAttemptOutcome(null, 'APPROVED')).toBe('succeeded');
    expect(toPaymentAttemptOutcome(undefined, 'success')).toBe('succeeded');
    expect(toPaymentAttemptOutcome(null, 'Completed')).toBe('succeeded');
  });

  it('maps pending text statuses to pending', () => {
    expect(toPaymentAttemptOutcome(null, 'PENDING')).toBe('pending');
    expect(toPaymentAttemptOutcome(null, 'processing')).toBe('pending');
  });

  it('maps a non-zero numeric code with unrecognised text to failed', () => {
    expect(toPaymentAttemptOutcome(1, 'SOMETHING_ELSE')).toBe('failed');
    expect(toPaymentAttemptOutcome(99, null)).toBe('failed');
  });

  it('defaults to pending when nothing is recognisable', () => {
    expect(toPaymentAttemptOutcome(null, null)).toBe('pending');
    expect(toPaymentAttemptOutcome(undefined, undefined)).toBe('pending');
    expect(toPaymentAttemptOutcome(null, 'UNKNOWN_TEXT')).toBe('pending');
  });
});
