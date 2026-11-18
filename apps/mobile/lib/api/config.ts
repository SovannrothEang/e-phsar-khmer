import Constants from "expo-constants";

/**
 * Base URL for the NestJS API, including its global `/api/v1` prefix.
 *
 * `EXPO_PUBLIC_API_URL` wins when set and is the only supported source for a
 * release build — Expo inlines it at bundle time, so it must be HTTPS there.
 * In development a dev build derives the backend host from Metro's own
 * address (`hostUri`, e.g. `192.168.1.20:8081`), so Expo Go on a phone reaches
 * the machine running Metro without a separate env for every device. A release
 * bundle without the value fails at startup instead of silently pointing at
 * `localhost`.
 */
const DEFAULT_API_URL = "http://localhost:3000/api/v1";
const BACKEND_PORT = 3000;

function devHostApiUrl(): string | null {
  if (!__DEV__) return null;
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (!host) return null;
  return `http://${host}:${BACKEND_PORT}/api/v1`;
}

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) return envUrl;
  const devUrl = devHostApiUrl();
  if (devUrl) return devUrl;
  if (__DEV__) return DEFAULT_API_URL;
  throw new Error(
    "EXPO_PUBLIC_API_URL must be set for a release build (see apps/mobile/README.md)",
  );
}

export const API_URL = resolveApiUrl().replace(/\/+$/, "");

/** Locales the backend resolves (`resolveLocale` in src/categories/locale.util.ts). */
export type ApiLocale = "en" | "km";

/**
 * The app ships `en | km`; the backend stores the same two and falls back to
 * `en` for anything else.
 */
export const normalizeApiLocale = (locale: string): ApiLocale => {
  if (locale === "km") return "km";
  return "en";
};
