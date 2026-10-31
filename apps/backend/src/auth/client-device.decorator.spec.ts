import { readClientDevice } from './client-device.decorator';

const CHROME_LINUX_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

function infoHeader(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

describe('readClientDevice', () => {
  it('reads a valid id and a trimmed name', () => {
    expect(
      readClientDevice({
        'x-device-id': 'device-12345678',
        'x-device-name': '  Chrome on Linux  ',
      }),
    ).toMatchObject({ id: 'device-12345678', name: 'Chrome on Linux' });
  });

  it('is case-insensitive about header names', () => {
    expect(
      readClientDevice({
        'X-Device-Id': 'device-12345678',
        'X-Device-Name': 'Chrome on Linux',
      }),
    ).toMatchObject({ id: 'device-12345678', name: 'Chrome on Linux' });
  });

  it('returns null when the id is missing', () => {
    expect(readClientDevice({})).toBeNull();
    expect(readClientDevice({ 'x-device-name': 'Chrome on Linux' })).toBeNull();
  });

  it('rejects ids with characters outside the accepted set', () => {
    expect(
      readClientDevice({ 'x-device-id': 'device id with spaces' }),
    ).toBeNull();
    expect(
      readClientDevice({ 'x-device-id': '<script>alert(1)</script>' }),
    ).toBeNull();
  });

  it('rejects ids shorter than 8 or longer than 128 characters', () => {
    expect(readClientDevice({ 'x-device-id': 'abc1234' })).toBeNull();
    expect(readClientDevice({ 'x-device-id': 'a'.repeat(129) })).toBeNull();
  });

  it('takes the first value of a duplicated header', () => {
    expect(
      readClientDevice({
        'x-device-id': ['device-12345678', 'device-87654321'],
      }),
    ).toMatchObject({ id: 'device-12345678', name: null });
  });

  it('caps the device name at 120 characters', () => {
    const result = readClientDevice({
      'x-device-id': 'device-12345678',
      'x-device-name': 'a'.repeat(150),
    });
    expect(result?.name).toHaveLength(120);
  });

  it('treats a blank name as null', () => {
    expect(
      readClientDevice({
        'x-device-id': 'device-12345678',
        'x-device-name': '   ',
      }),
    ).toMatchObject({ id: 'device-12345678', name: null });
  });

  it('parses a URL-encoded browser info header and fills from the UA', () => {
    expect(
      readClientDevice({
        'x-device-id': 'device-12345678',
        'x-device-info': infoHeader({
          type: 'browser',
          clientVersion: '2026.10.20',
          userAgent: CHROME_LINUX_UA,
        }),
      }),
    ).toMatchObject({
      id: 'device-12345678',
      name: 'Chrome on Linux',
      type: 'browser',
      clientVersion: '2026.10.20',
      browserName: 'Chrome',
      browserVersion: '154.0.0.0',
      osName: 'Linux',
      model: null,
      userAgent: CHROME_LINUX_UA,
    });
  });

  it('parses a plain JSON app info header and never parses its UA', () => {
    expect(
      readClientDevice({
        'x-device-id': 'device-12345678',
        'x-device-info': JSON.stringify({
          type: 'app',
          clientVersion: '2026.10.20',
          model: 'PKG110',
          osName: 'Android',
          osVersion: '13',
          userAgent: 'okhttp/4.12.0',
        }),
      }),
    ).toMatchObject({
      id: 'device-12345678',
      name: 'PKG110',
      type: 'app',
      clientVersion: '2026.10.20',
      browserName: null,
      model: 'PKG110',
      osName: 'Android',
      osVersion: '13',
    });
  });

  it('prefers a supplied name over the derived label', () => {
    const result = readClientDevice({
      'x-device-id': 'device-12345678',
      'x-device-name': 'Work laptop',
      'x-device-info': infoHeader({
        type: 'browser',
        userAgent: CHROME_LINUX_UA,
      }),
    });
    expect(result?.name).toBe('Work laptop');
  });

  it('falls back to the standard user-agent header when no info is sent', () => {
    expect(
      readClientDevice({
        'x-device-id': 'device-12345678',
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
      }),
    ).toMatchObject({
      type: 'browser',
      browserName: 'Safari',
      osName: 'iOS',
      model: 'iPhone',
      name: 'Safari on iOS',
    });
  });

  it('does not call an opaque UA a browser', () => {
    expect(
      readClientDevice({
        'x-device-id': 'device-12345678',
        'user-agent': 'okhttp/4.12.0',
      }),
    ).toMatchObject({ type: null, browserName: null, name: null });
  });

  it('ignores malformed info but still records the id and name', () => {
    expect(
      readClientDevice({
        'x-device-id': 'device-12345678',
        'x-device-name': 'Chrome on Linux',
        'x-device-info': '%7Bnot-json',
      }),
    ).toMatchObject({
      id: 'device-12345678',
      name: 'Chrome on Linux',
      type: null,
    });
  });

  it('ignores an unknown client type', () => {
    const result = readClientDevice({
      'x-device-id': 'device-12345678',
      'x-device-info': infoHeader({ type: 'tablet', model: 'PKG110' }),
    });
    expect(result?.type).toBeNull();
  });

  it('caps long metadata at the column limits', () => {
    const result = readClientDevice({
      'x-device-id': 'device-12345678',
      'x-device-info': infoHeader({
        type: 'app',
        model: 'm'.repeat(200),
        osName: 'o'.repeat(200),
      }),
    });
    expect(result?.model).toHaveLength(80);
    expect(result?.osName).toHaveLength(40);
  });
});
