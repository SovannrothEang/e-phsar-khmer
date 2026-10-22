/**
 * Stable browser-generated device identity for the "new device login" alert
 * and the settings/devices list.
 *
 * The id lives in localStorage, so it survives logouts and restarts but is
 * per browser profile (a different browser or profile is correctly a new
 * device). It is mirrored into a non-httpOnly cookie so server-side code
 * (the RSC devices page, token refresh) can forward it as `x-device-id`; the
 * id is not a secret and grants no access.
 *
 * Everything here is fail-soft: private mode / blocked storage returns null,
 * and the login simply proceeds without device tracking.
 */
import {
  DEVICE_ID_COOKIE,
  DEVICE_ID_MAX_AGE,
  DEVICE_ID_PATTERN,
} from "./device-id";

export interface DeviceIdentity {
  id: string;
  name: string;
}

const STORAGE_KEY = "psa_device_id";

function randomId(): string | null {
  if (typeof crypto === "undefined") return null;

  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Older browsers without randomUUID; 16 random bytes as 32 hex chars still
  // satisfies the backend's id pattern.
  if (typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  return null;
}

function readCookie(): string | null {
  try {
    const prefix = `${DEVICE_ID_COOKIE}=`;
    for (const part of document.cookie.split("; ")) {
      if (part.startsWith(prefix)) {
        return decodeURIComponent(part.slice(prefix.length));
      }
    }
  } catch {
    /* blocked cookies */
  }
  return null;
}

function writeCookie(id: string): void {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${DEVICE_ID_COOKIE}=${encodeURIComponent(
      id,
    )}; Path=/; Max-Age=${DEVICE_ID_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    /* blocked cookies */
  }
}

/** localStorage first, then the mirrored cookie, then a fresh id. */
function resolveId(): string | null {
  let id: string | null = null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && DEVICE_ID_PATTERN.test(stored)) id = stored;
  } catch {
    /* blocked storage */
  }

  if (!id) {
    const cookie = readCookie();
    if (cookie && DEVICE_ID_PATTERN.test(cookie)) id = cookie;
  }

  if (!id) id = randomId();
  if (!id) return null;

  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* blocked storage — the cookie still carries it */
  }
  writeCookie(id);

  return id;
}

/** The browser's device id + a no-version label, or null when unavailable. */
export function getDeviceIdentity(): DeviceIdentity | null {
  if (typeof window === "undefined") return null;

  const id = resolveId();
  if (!id) return null;

  return { id, name: describeDevice(navigator.userAgent) };
}

/**
 * "Chrome on Linux", "Safari on iOS", ... Versions are deliberately omitted
 * from the notification label so a browser auto-update does not look like a
 * new device. Edge and Opera are checked before Chrome, and Chrome before
 * Safari, because their user agents contain each other's tokens.
 *
 * The devices page's title/version come from the backend parser instead.
 */
export function describeDevice(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent) || /CriOS\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";

  const os = /iPhone|iPad|iPod/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${os}`;
}
