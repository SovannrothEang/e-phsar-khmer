import { PgDialect } from 'drizzle-orm/pg-core';
import {
  NEARBY_LIMIT_DEFAULT,
  NEARBY_LIMIT_MAX,
  NEARBY_RADIUS_KM_DEFAULT,
  NEARBY_RADIUS_KM_MAX,
  NEARBY_RADIUS_KM_MIN,
  nearbyBoundingBox,
  nearbyDistanceKmSql,
} from './nearby';

describe('nearbyDistanceKmSql', () => {
  it('casts numeric coordinates to float8 and clamps the asin argument', () => {
    const { sql, params } = new PgDialect().sqlToQuery(
      nearbyDistanceKmSql(11.5564, 104.9282),
    );

    expect(sql).toContain('::float8');
    expect(sql).toContain('asin');
    expect(sql).toContain('least(1');
    expect(params).toEqual(expect.arrayContaining([11.5564, 104.9282]));
  });
});

describe('nearby bounds', () => {
  it('uses the documented radius and limit bounds', () => {
    expect(NEARBY_RADIUS_KM_DEFAULT).toBe(10);
    expect(NEARBY_RADIUS_KM_MIN).toBe(1);
    expect(NEARBY_RADIUS_KM_MAX).toBe(50);
    expect(NEARBY_LIMIT_DEFAULT).toBe(8);
    expect(NEARBY_LIMIT_MAX).toBe(24);
  });
});

describe('nearbyBoundingBox', () => {
  it('is a superset of the radius circle', () => {
    const box = nearbyBoundingBox(11.5564, 104.9282, 10);
    const trueLatDelta = 10 / 111.195;

    expect(box.minLat).toBeLessThan(11.5564 - trueLatDelta);
    expect(box.maxLat).toBeGreaterThan(11.5564 + trueLatDelta);
    expect(box.lngWraps).toBe(false);
  });

  it('flags a box that crosses the antimeridian', () => {
    expect(nearbyBoundingBox(0, 179.95, 50).lngWraps).toBe(true);
    expect(nearbyBoundingBox(0, -179.95, 50).lngWraps).toBe(true);
    expect(nearbyBoundingBox(0, 104.9, 50).lngWraps).toBe(false);
  });
});
