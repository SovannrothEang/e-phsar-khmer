import {
  base64EncodeAbaPaywayUrl,
  formatAbaPaywayReqTime,
} from './aba-payway.encoding';

describe('base64EncodeAbaPaywayUrl', () => {
  it('base64-encodes the URL as UTF-8', () => {
    expect(base64EncodeAbaPaywayUrl('https://example.com/webhook')).toBe(
      Buffer.from('https://example.com/webhook', 'utf-8').toString('base64'),
    );
  });

  it('is reversible', () => {
    const url = 'https://api.example.com/api/v1/payments/aba-payway/webhook';
    const encoded = base64EncodeAbaPaywayUrl(url);
    expect(Buffer.from(encoded, 'base64').toString('utf-8')).toBe(url);
  });
});

describe('formatAbaPaywayReqTime', () => {
  it('formats a UTC date as a 14-digit YYYYMMDDHHmmss string', () => {
    const date = new Date(Date.UTC(2026, 8, 16, 9, 5, 3));
    expect(formatAbaPaywayReqTime(date)).toBe('20260916090503');
  });

  it('pads single-digit month/day/hour/minute/second', () => {
    const date = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(formatAbaPaywayReqTime(date)).toBe('20260101000000');
  });

  it('uses UTC, not local time', () => {
    // A date constructed with an explicit UTC offset — the formatted
    // result must reflect the UTC instant, not the offset's local clock.
    const date = new Date('2026-09-16T23:30:00+07:00');
    expect(formatAbaPaywayReqTime(date)).toBe('20260916163000');
  });
});
