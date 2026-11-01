import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import {
  cleanText,
  describeUserAgent,
  parseUserAgent,
  type ClientType,
  type ParsedUserAgent,
} from './user-agent.util';

/**
 * What the web (or any client) tells us about the device it is logging in
 * from. Deliberately carried in headers rather than DTO fields: Telegram's
 * login payload is HMAC'd over its own fields, so adding body fields there
 * would break verification, while headers work uniformly on every auth route.
 *
 * Contract:
 *   x-device-id    required, ^[A-Za-z0-9._:-]{8,128}$
 *   x-device-name  optional, <=120, the preferred display label
 *   x-device-info  optional, URL-encoded (or plain) JSON:
 *     {
 *       "type": "browser" | "app",
 *       "clientVersion": "2026.10.20",
 *       "browserName": "Chrome", "browserVersion": "154.0.0.0",
 *       "osName": "Linux", "osVersion": "6.1",
 *       "model": "PKG110",
 *       "userAgent": "<raw UA>"
 *     }
 *
 * Browser sessions may send only the raw UA; the backend parses it. App
 * clients send the structured fields (their HTTP UA is not useful). Every
 * field is optional and best-effort: a malformed info header never fails the
 * login, and the id alone is still enough to record the device.
 */
export interface ClientDeviceInfo {
  /** Browser-generated stable id; validated before it is stored. */
  id: string;
  /** Friendly label (e.g. "Chrome on Linux"), already trimmed/capped. */
  name: string | null;
  /** Optional structured metadata; flat so `{id, name}` stays a valid shape. */
  type?: ClientType | null;
  clientVersion?: string | null;
  browserName?: string | null;
  browserVersion?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  model?: string | null;
  userAgent?: string | null;
}

export type ClientDeviceHeaders = Record<string, string | string[] | undefined>;

/** The same shape the browser generates; reject arbitrary blobs. */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const DEVICE_NAME_MAX_LENGTH = 120;
const INFO_HEADER_MAX_LENGTH = 4096;
const CLIENT_VERSION_PATTERN = /^[0-9A-Za-z._+-]{1,40}$/;

const FIELD_LIMITS = {
  browserName: 40,
  browserVersion: 40,
  osName: 40,
  osVersion: 40,
  model: 80,
  userAgent: 512,
  clientVersion: 40,
} as const;

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function clean(value: string | null | undefined, max: number): string | null {
  return cleanText(value, max);
}

function stringField(
  obj: Record<string, unknown>,
  key: keyof typeof FIELD_LIMITS,
): string | null {
  const value = obj[key];
  return typeof value === 'string' ? clean(value, FIELD_LIMITS[key]) : null;
}

interface ParsedInfo {
  type: ClientType | null;
  clientVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  model: string | null;
  userAgent: string | null;
}

function parseInfo(
  raw: string | null,
  headerUserAgent: string | null,
): ParsedInfo | null {
  if (!raw) return null;
  if (raw.length > INFO_HEADER_MAX_LENGTH) return null;

  let json = raw;
  if (raw.includes('%')) {
    try {
      json = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const rawType = typeof obj.type === 'string' ? obj.type.toLowerCase() : null;
  const type: ClientType | null =
    rawType === 'browser' || rawType === 'app' ? rawType : null;

  const clientVersionRaw = obj.clientVersion;
  const clientVersion =
    typeof clientVersionRaw === 'string' &&
    CLIENT_VERSION_PATTERN.test(clientVersionRaw.trim())
      ? clientVersionRaw.trim()
      : null;

  return {
    type,
    clientVersion,
    browserName: stringField(obj, 'browserName'),
    browserVersion: stringField(obj, 'browserVersion'),
    osName: stringField(obj, 'osName'),
    osVersion: stringField(obj, 'osVersion'),
    model: stringField(obj, 'model'),
    userAgent: stringField(obj, 'userAgent') ?? clean(headerUserAgent, 512),
  };
}

function fromUserAgent(
  parsed: ParsedUserAgent,
  userAgent: string | null,
): ParsedInfo {
  return {
    // A direct client with an opaque UA (okhttp, curl) is not a browser.
    type: parsed.browserName ? 'browser' : null,
    clientVersion: null,
    browserName: parsed.browserName,
    browserVersion: parsed.browserVersion,
    osName: parsed.osName,
    osVersion: parsed.osVersion,
    model: parsed.deviceModel,
    userAgent: clean(userAgent, 512),
  };
}

/**
 * Pure header parser — exported so the unit tests exercise the real rules
 * (missing/invalid ids, duplicate headers, name trimming) without booting
 * Nest's parameter-decorator machinery.
 */
export function readClientDevice(
  headers: ClientDeviceHeaders,
): ClientDeviceInfo | null {
  // Node lowercases incoming header names, but tests and future adapters may
  // not; normalize so the lookup is case-insensitive.
  const normalized: ClientDeviceHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  const id = firstValue(normalized['x-device-id'])?.trim();
  if (!id || !DEVICE_ID_PATTERN.test(id)) return null;

  const rawName = firstValue(normalized['x-device-name'])?.trim();
  const suppliedName = rawName
    ? rawName.slice(0, DEVICE_NAME_MAX_LENGTH)
    : null;

  const headerUserAgent = firstValue(normalized['user-agent']);
  const info =
    parseInfo(firstValue(normalized['x-device-info']), headerUserAgent) ??
    (headerUserAgent
      ? fromUserAgent(parseUserAgent(headerUserAgent), headerUserAgent)
      : null);

  // A browser UA is the fallback for any field the client did not state.
  const uaParsed =
    info?.type === 'browser' && info.userAgent
      ? parseUserAgent(info.userAgent)
      : null;

  const browserName = info?.browserName ?? uaParsed?.browserName ?? null;
  const browserVersion =
    info?.browserVersion ?? uaParsed?.browserVersion ?? null;
  const osName = info?.osName ?? uaParsed?.osName ?? null;
  const osVersion = info?.osVersion ?? uaParsed?.osVersion ?? null;
  const model = info?.model ?? uaParsed?.deviceModel ?? null;
  const name =
    suppliedName ??
    (uaParsed
      ? describeUserAgent(uaParsed)
      : browserName && osName
        ? `${browserName} on ${osName}`
        : browserName) ??
    model;

  return {
    id,
    name,
    type: info?.type ?? null,
    clientVersion: info?.clientVersion ?? null,
    browserName,
    browserVersion,
    osName,
    osVersion,
    model,
    userAgent: info?.userAgent ?? null,
  };
}

/** Resolves `ClientDeviceInfo | null` from the current request's headers. */
export const ClientDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientDeviceInfo | null => {
    const request = ctx.switchToHttp().getRequest<{
      headers: ClientDeviceHeaders;
    }>();
    return readClientDevice(request.headers ?? {});
  },
);
