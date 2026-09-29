import { diffDevices } from './e2e-devices.util';

describe('diffDevices', () => {
  const expected = [
    { userId: 'peer', deviceId: 'p1' },
    { userId: 'peer', deviceId: 'p2' },
    { userId: 'me', deviceId: 'm2' },
  ];

  it('reports nothing when the sets match (order-insensitive)', () => {
    expect(diffDevices(expected, ['m2', 'p2', 'p1'])).toEqual({
      missing: [],
      stale: [],
    });
  });

  it('reports a newly added device as missing', () => {
    expect(diffDevices(expected, ['p1', 'm2'])).toEqual({
      missing: [{ userId: 'peer', deviceId: 'p2' }],
      stale: [],
    });
  });

  it('reports a revoked device as stale', () => {
    expect(diffDevices(expected, ['p1', 'p2', 'm2', 'gone'])).toEqual({
      missing: [],
      stale: ['gone'],
    });
  });

  it('reports both at once (device swapped)', () => {
    expect(diffDevices(expected, ['p1', 'old', 'm2'])).toEqual({
      missing: [{ userId: 'peer', deviceId: 'p2' }],
      stale: ['old'],
    });
  });
});
