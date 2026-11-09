import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryNearbyDto } from './query-nearby.dto';

async function errorsFor(raw: Record<string, unknown>) {
  const dto = plainToInstance(QueryNearbyDto, raw, {
    enableImplicitConversion: true,
  });
  return validate(dto);
}

describe('QueryNearbyDto', () => {
  it('accepts a valid point, coerces the numbers and applies defaults', async () => {
    const dto = plainToInstance(
      QueryNearbyDto,
      { lat: '11.5564', lng: '104.9282' },
      { enableImplicitConversion: true },
    );

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.lat).toBe(11.5564);
    expect(dto.lng).toBe(104.9282);
    expect(dto.radiusKm).toBe(10);
    expect(dto.limit).toBe(8);
  });

  it.each([
    ['missing lat', { lng: '104.9282' }],
    ['missing lng', { lat: '11.5564' }],
    ['empty lat', { lat: '', lng: '104.9282' }],
    ['whitespace lng', { lat: '11.5564', lng: '   ' }],
    ['non-numeric lat', { lat: 'abc', lng: '104.9282' }],
    ['lat out of range', { lat: '91', lng: '104.9282' }],
    ['lng out of range', { lat: '11.5564', lng: '-181' }],
    [
      'radius below minimum',
      { lat: '11.5564', lng: '104.9282', radiusKm: '0.5' },
    ],
    [
      'radius above maximum',
      { lat: '11.5564', lng: '104.9282', radiusKm: '51' },
    ],
    ['limit zero', { lat: '11.5564', lng: '104.9282', limit: '0' }],
    ['limit above maximum', { lat: '11.5564', lng: '104.9282', limit: '25' }],
  ])('rejects %s', async (_label, raw) => {
    expect(await errorsFor(raw)).not.toHaveLength(0);
  });
});
