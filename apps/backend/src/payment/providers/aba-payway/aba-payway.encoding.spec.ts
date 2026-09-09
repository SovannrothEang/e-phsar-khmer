import { base64EncodeAbaPaywayUrl } from './aba-payway.encoding';

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
