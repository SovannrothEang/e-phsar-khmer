/**
 * Small dependency-free user-agent parser for the devices page.
 *
 * Only what a session row needs: a browser name + version, an OS name +
 * version, and a phone/tablet model when the UA carries one. Everything is
 * best-effort display data — never a security decision — so unknown shapes
 * degrade to nulls rather than throwing.
 *
 * Known limits, deliberately accepted:
 * - iOS Safari never exposes the hardware generation (only "iPhone"/"iPad").
 * - iPadOS 13+ in desktop mode sends a macOS UA, so it reads as macOS Safari.
 * - Chrome's UA reduction caps minor versions at 0.0.0, which is fine because
 *   the devices page only shows the major version.
 */

export type ClientType = 'browser' | 'app';

export interface ParsedUserAgent {
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  isMobile: boolean;
}

const EMPTY: ParsedUserAgent = {
  browserName: null,
  browserVersion: null,
  osName: null,
  osVersion: null,
  deviceModel: null,
  isMobile: false,
};

/** Trim, drop control characters, and cap at the column length. */
export function cleanText(
  value: string | null | undefined,
  max: number,
): string | null {
  if (!value) return null;
  let cleaned = '';
  for (const char of value.trim()) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x20 && code !== 0x7f) cleaned += char;
  }
  return cleaned ? cleaned.slice(0, max) : null;
}

function match(ua: string, pattern: RegExp): string | null {
  return pattern.exec(ua)?.[1] ?? null;
}

/** Android models sit in the parenthetical comment, usually before "Build/". */
function androidModel(ua: string): string | null {
  // Example: "(Linux; Android 13; PKG110 Build/TP1A...)"; older UAs add a
  // locale token before the model, so prefer the Build-bearing segment.
  const comment = /\((?:[^()]*?);\s*Android[^;)]*;([^)]*)\)/i.exec(ua)?.[1];
  if (!comment) return null;
  const segments = comment
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const withBuild = segments.find((part) => /\bBuild\//i.test(part));
  const model = (withBuild ?? segments[segments.length - 1] ?? '')
    .split(/\s+Build\//i)[0]
    ?.trim();
  // Generic WebView/tablet tokens are not model names.
  if (!model || /^(wv|mobile|tablet|k)$/i.test(model)) return null;
  return cleanText(model, 80);
}

export function parseUserAgent(
  userAgent: string | null | undefined,
): ParsedUserAgent {
  const ua = userAgent?.trim();
  if (!ua) return { ...EMPTY };

  // Order matters: Edge/Opera/Firefox/Chrome UAs contain each other's tokens.
  let browserName: string | null = null;
  let browserVersion: string | null = null;
  if ((browserVersion = match(ua, /(?:Edg|EdgiOS)\/([\d.]+)/i))) {
    browserName = 'Microsoft Edge';
  } else if ((browserVersion = match(ua, /(?:OPR|OPiOS)\/([\d.]+)/i))) {
    browserName = 'Opera';
  } else if ((browserVersion = match(ua, /SamsungBrowser\/([\d.]+)/i))) {
    browserName = 'Samsung Internet';
  } else if ((browserVersion = match(ua, /(?:Firefox|FxiOS)\/([\d.]+)/i))) {
    browserName = 'Firefox';
  } else if ((browserVersion = match(ua, /(?:Chrome|CriOS)\/([\d.]+)/i))) {
    browserName = 'Chrome';
  } else if (
    /Safari\//i.test(ua) &&
    (browserVersion = match(ua, /Version\/([\d.]+)/i))
  ) {
    browserName = 'Safari';
  }

  let osName: string | null = null;
  let osVersion: string | null = null;
  let deviceModel: string | null = null;
  let isMobile = false;

  if (/iPhone|iPad|iPod/i.test(ua)) {
    osName = 'iOS';
    osVersion =
      match(ua, /CPU(?: (?:iPhone|iPad|iPod))? OS ([\d_]+)/i)?.replace(
        /_/g,
        '.',
      ) ?? null;
    deviceModel = /iPad/i.test(ua)
      ? 'iPad'
      : /iPod/i.test(ua)
        ? 'iPod'
        : 'iPhone';
    isMobile = true;
  } else if (/Android/i.test(ua)) {
    osName = 'Android';
    osVersion = match(ua, /Android\s+([\d.]+)/i);
    deviceModel = androidModel(ua);
    isMobile = true;
  } else if (/Windows NT/i.test(ua)) {
    osName = 'Windows';
    osVersion = match(ua, /Windows NT ([\d.]+)/i);
  } else if (/CrOS/i.test(ua)) {
    osName = 'ChromeOS';
  } else if (/Mac OS X/i.test(ua)) {
    osName = 'macOS';
    osVersion = match(ua, /Mac OS X ([\d_.]+)/i)?.replace(/_/g, '.') ?? null;
  } else if (/Linux/i.test(ua)) {
    osName = 'Linux';
  }

  return {
    browserName: cleanText(browserName, 40),
    browserVersion: cleanText(browserVersion, 40),
    osName: cleanText(osName, 40),
    osVersion: cleanText(osVersion, 40),
    deviceModel: cleanText(deviceModel, 80),
    isMobile,
  };
}

/** "Chrome on Linux" — the notification/dialog label. */
export function describeUserAgent(parsed: ParsedUserAgent): string | null {
  if (parsed.browserName && parsed.osName) {
    return `${parsed.browserName} on ${parsed.osName}`;
  }
  return parsed.browserName ?? parsed.osName ?? null;
}
