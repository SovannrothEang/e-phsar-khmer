import Constants from "expo-constants";

/**
 * Base URL for the NestJS API, including its global `/api/v1` prefix.
 *
 * `EXPO_PUBLIC_API_URL` wins when set. Otherwise a dev build derives the
 * backend host from Metro's own address (`hostUri`, e.g. `192.168.1.20:8081`),
 * so Expo Go on a phone reaches the machine running Metro without a separate
 * env for every device. Production must set `EXPO_PUBLIC_API_URL` at build
 * time — it is inlined into the bundle, and `localhost` is useless on a phone.
 */
const DEFAULT_API_URL = "http://localhost:3000/api/v1";
const BACKEND_PORT = 3000;

function devHostApiUrl(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (!host) return null;
  return `http://${host}:${BACKEND_PORT}/api/v1`;
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  devHostApiUrl() ||
  DEFAULT_API_URL
).replace(/\/+$/, "");

/** Locales the backend resolves (`resolveLocale` in src/categories/locale.util.ts). */
export type ApiLocale = "en" | "km" | "zh";

/**
 * The app ships `en | km | zh | ko`; the backend stores `en | km | zh` and
 * falls back to `en` for anything else, so Korean maps to English.
 */
export const normalizeApiLocale = (locale: string): ApiLocale => {
  if (locale === "km" || locale === "zh") return locale;
  return "en";
};
