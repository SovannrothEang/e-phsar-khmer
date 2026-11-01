/** One active login device, as `GET /auth/devices` returns it. */
export interface LoginDevice {
  id: string;
  name: string;
  clientType: "browser" | "app" | null;
  clientVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

/**
 * A device row decorated by the RSC with its display-time labels. Computing
 * them on the server keeps SSR and hydration byte-identical (a client-side
 * `new Date()` would drift between the two renders).
 */
export interface DeviceView extends LoginDevice {
  createdLabel: string;
  lastSeenLabel: string;
}
