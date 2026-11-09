import geography from '../../db/seeds/data/cambodia-geography.json';
import { PROVINCE_CENTERS, demoListingCoordinates } from './province-centers';

describe('PROVINCE_CENTERS', () => {
  const slugs = geography.provinces.map((province) => province.slug);

  it('covers every province in the geography seed', () => {
    expect(Object.keys(PROVINCE_CENTERS).sort()).toEqual([...slugs].sort());
  });

  it('holds finite coordinates inside the valid ranges', () => {
    for (const slug of slugs) {
      const { lat, lng } = PROVINCE_CENTERS[slug];
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lng)).toBe(true);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
    }
  });

  it('places Phnom Penh at the capital', () => {
    expect(PROVINCE_CENTERS['phnom-penh'].lat).toBeCloseTo(11.5564, 2);
    expect(PROVINCE_CENTERS['phnom-penh'].lng).toBeCloseTo(104.9282, 2);
  });
});

describe('demoListingCoordinates', () => {
  it('returns null without a province or for an unknown slug', () => {
    expect(demoListingCoordinates(undefined, 'title')).toBeNull();
    expect(demoListingCoordinates('not-a-province', 'title')).toBeNull();
  });

  it('maps the legacy sihanoukville slug to preah-sihanouk', () => {
    const legacy = demoListingCoordinates('sihanoukville', 'title');
    const current = demoListingCoordinates('preah-sihanouk', 'title');

    expect(legacy).not.toBeNull();
    expect(legacy).toEqual(current);
  });

  it('is deterministic and stays near the province centre', () => {
    const first = demoListingCoordinates('phnom-penh', 'Toyota Camry 2019');
    const again = demoListingCoordinates('phnom-penh', 'Toyota Camry 2019');

    expect(first).toEqual(again);
    expect(first).not.toBeNull();
    expect(Number(first?.latitude)).toBeCloseTo(11.5564, 1);
    expect(Number(first?.longitude)).toBeCloseTo(104.9282, 1);
  });

  it('does not put every ad in a province on the same pin', () => {
    const pins = new Set(
      Array.from({ length: 10 }, (_, index) =>
        JSON.stringify(
          demoListingCoordinates('siem-reap', `demo listing ${index}`),
        ),
      ),
    );

    expect(pins.size).toBeGreaterThan(1);
  });

  it('keeps two same-province ads 25 apart on different pins', () => {
    expect(demoListingCoordinates('siem-reap', 'listing A')).not.toEqual(
      demoListingCoordinates('siem-reap', 'listing B'),
    );
  });
});
