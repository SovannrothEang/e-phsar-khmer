import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { tokenStore } from "@/lib/auth/token-store";

/** The three headers the backend reads for `user_login_devices`. */
export interface DeviceHeaders {
  [header: string]: string;
  "x-device-id": string;
  "x-device-name": string;
  "x-device-info": string;
}

const clientVersion = Constants.expoConfig?.version ?? "1.0.0";

function fallbackModel(): string {
  if (Platform.OS === "android") return "Android Device";
  if (Platform.OS === "ios") return "iPhone";
  return "Web Browser";
}

function fallbackOsName(): string {
  if (Platform.OS === "android") return "Android";
  if (Platform.OS === "ios") return "iOS";
  return "Web";
}

/**
 * Device identity for login, OTP verify, refresh and authenticated calls.
 * Mirrors the backend's native payload: `{ type: 'app', model, osName,
 * osVersion, clientVersion }`, URL-encoded into one header. The id is cached
 * for the app lifetime (and persisted by the token store) because the backend
 * matches it to the `user_login_devices` row across logouts.
 */
let cachedHeaders: Promise<DeviceHeaders> | null = null;

export function getDeviceHeaders(): Promise<DeviceHeaders> {
  if (!cachedHeaders) {
    cachedHeaders = buildDeviceHeaders().catch((error) => {
      cachedHeaders = null;
      throw error;
    });
  }
  return cachedHeaders;
}

async function buildDeviceHeaders(): Promise<DeviceHeaders> {
  const model = Device.modelName || fallbackModel();
  const osName = Device.osName || fallbackOsName();
  const osVersion = Device.osVersion || String(Platform.Version ?? "");
  const name = osVersion ? `${model}: ${osVersion}` : model;

  return {
    "x-device-id": await tokenStore.getDeviceId(),
    "x-device-name": name,
    "x-device-info": encodeURIComponent(
      JSON.stringify({ type: "app", model, osName, osVersion, clientVersion }),
    ),
  };
}
