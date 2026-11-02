import { stableStringify } from './stable-stringify.util';

describe('stableStringify', () => {
  it('ignores object key order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(
      stableStringify({ a: 2, b: 1 }),
    );
  });

  it('sorts nested objects, including inside arrays', () => {
    expect(stableStringify({ x: [{ b: 1, a: 2 }] })).toBe(
      '{"x":[{"a":2,"b":1}]}',
    );
  });

  it('keeps array order (order is meaningful there)', () => {
    expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]));
  });

  it('serialises primitives and null like JSON', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify('a')).toBe('"a"');
    expect(stableStringify(3)).toBe('3');
  });

  it('serialises Dates as ISO strings, so two different dates do not collide', () => {
    const a = new Date('2026-11-02T10:00:00.000Z');
    const b = new Date('2026-11-02T10:00:01.000Z');
    expect(stableStringify({ at: a })).not.toBe(stableStringify({ at: b }));
    expect(stableStringify({ at: a })).toBe(stableStringify({ at: a }));
    expect(stableStringify({ at: a })).toBe(
      '{"at":"2026-11-02T10:00:00.000Z"}',
    );
  });
});
