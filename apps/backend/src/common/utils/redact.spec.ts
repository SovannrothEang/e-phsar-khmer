import { redactSensitiveQuery } from './redact';

describe('redactSensitiveQuery', () => {
  it('redacts the nearby origin and keeps the other params', () => {
    expect(
      redactSensitiveQuery(
        '/api/v1/listings/nearby?lat=11.5564&lng=104.9282&radiusKm=10',
      ),
    ).toBe('/api/v1/listings/nearby?lat=[redacted]&lng=[redacted]&radiusKm=10');
  });

  it('redacts coordinates in any query position', () => {
    expect(redactSensitiveQuery('/x?lng=104.9&limit=8&lat=11.5')).toBe(
      '/x?lng=[redacted]&limit=8&lat=[redacted]',
    );
  });

  it('redacts the long spellings too', () => {
    expect(
      redactSensitiveQuery('/x?latitude=11.5&longitude=104.9&limit=8'),
    ).toBe('/x?latitude=[redacted]&longitude=[redacted]&limit=8');
  });

  it('leaves URLs without coordinates untouched', () => {
    expect(redactSensitiveQuery('/api/v1/listings?limit=8')).toBe(
      '/api/v1/listings?limit=8',
    );
  });
});
