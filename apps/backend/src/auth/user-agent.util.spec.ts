import { describeUserAgent, parseUserAgent } from './user-agent.util';

const UA = {
  chromeLinux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0',
  opera:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 OPR/130.0.0.0',
  firefox:
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:154.0) Gecko/20100101 Firefox/154.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  safariIpad:
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; PKG110 Build/TP1A.220905.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.0.0 Mobile Safari/537.36',
  androidLegacy:
    'Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/125.0.0.0 Mobile Safari/537.36',
};

describe('parseUserAgent', () => {
  it('parses Chrome on Linux', () => {
    expect(parseUserAgent(UA.chromeLinux)).toMatchObject({
      browserName: 'Chrome',
      browserVersion: '154.0.0.0',
      osName: 'Linux',
      deviceModel: null,
      isMobile: false,
    });
  });

  it('prefers Edge over the Chrome token it carries', () => {
    expect(parseUserAgent(UA.edgeWindows)).toMatchObject({
      browserName: 'Microsoft Edge',
      browserVersion: '154.0.0.0',
      osName: 'Windows',
      osVersion: '10.0',
    });
  });

  it('prefers Opera over the Chrome token it carries', () => {
    expect(parseUserAgent(UA.opera)).toMatchObject({
      browserName: 'Opera',
      browserVersion: '130.0.0.0',
      osName: 'Linux',
    });
  });

  it('prefers Samsung Internet over the Chrome token it carries', () => {
    expect(parseUserAgent(UA.samsung)).toMatchObject({
      browserName: 'Samsung Internet',
      browserVersion: '26.0',
      osName: 'Android',
      osVersion: '14',
      deviceModel: 'SM-S918B',
    });
  });

  it('parses Firefox on Linux', () => {
    expect(parseUserAgent(UA.firefox)).toMatchObject({
      browserName: 'Firefox',
      browserVersion: '154.0',
      osName: 'Linux',
    });
  });

  it('parses Safari on macOS', () => {
    expect(parseUserAgent(UA.safariMac)).toMatchObject({
      browserName: 'Safari',
      browserVersion: '18.4',
      osName: 'macOS',
      osVersion: '10.15.7',
      isMobile: false,
    });
  });

  it('parses Safari on iPhone without inventing a hardware generation', () => {
    expect(parseUserAgent(UA.safariIphone)).toMatchObject({
      browserName: 'Safari',
      browserVersion: '18.2',
      osName: 'iOS',
      osVersion: '18.2',
      deviceModel: 'iPhone',
      isMobile: true,
    });
  });

  it('parses Safari on iPad', () => {
    expect(parseUserAgent(UA.safariIpad)).toMatchObject({
      osName: 'iOS',
      osVersion: '17.4',
      deviceModel: 'iPad',
      isMobile: true,
    });
  });

  it('extracts the Android model before the Build token', () => {
    expect(parseUserAgent(UA.androidChrome)).toMatchObject({
      browserName: 'Chrome',
      osName: 'Android',
      osVersion: '13',
      deviceModel: 'PKG110',
      isMobile: true,
    });
  });

  it('finds the model in an older Android UA with locale tokens first', () => {
    expect(parseUserAgent(UA.androidLegacy)).toMatchObject({
      osName: 'Android',
      osVersion: '4.0.3',
      deviceModel: 'LG-L160L',
    });
  });

  it('degrades unknown or empty UAs to nulls', () => {
    expect(parseUserAgent('')).toEqual({
      browserName: null,
      browserVersion: null,
      osName: null,
      osVersion: null,
      deviceModel: null,
      isMobile: false,
    });
    expect(parseUserAgent('curl/8.0.1')).toMatchObject({
      browserName: null,
      osName: null,
      isMobile: false,
    });
  });

  it('builds the "Browser on OS" label', () => {
    expect(describeUserAgent(parseUserAgent(UA.chromeLinux))).toBe(
      'Chrome on Linux',
    );
    expect(describeUserAgent(parseUserAgent('curl/8.0.1'))).toBeNull();
  });
});
