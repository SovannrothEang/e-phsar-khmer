"use server";

import { getTranslations } from "next-intl/server";
import { ApiError, userServerFetch } from "@/lib/api/user-client";
import { getUserDeviceId } from "@/lib/auth/session";

export interface DeviceActionResult {
  success: boolean;
  error?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function toFailure(err: unknown): Promise<DeviceActionResult> {
  const t = await getTranslations("Settings.errors");
  if (!(err instanceof ApiError)) {
    return { success: false, error: t("network") };
  }
  switch (err.code) {
    case "CANNOT_REVOKE_CURRENT_DEVICE":
      return {
        success: false,
        error: t("currentDevice"),
      };
    case "NO_ACTIVE_SESSION":
      return {
        success: false,
        error: t("noActiveSession"),
      };
    case "DEVICE_NOT_FOUND":
      return {
        success: false,
        error: t("deviceNotFound"),
      };
    default:
      return { success: false, error: err.message };
  }
}

async function deviceHeaders(): Promise<Record<string, string> | undefined> {
  const deviceId = await getUserDeviceId();
  return deviceId ? { "x-device-id": deviceId } : undefined;
}

/** Sign out one other device. */
export async function revokeDevice(id: string): Promise<DeviceActionResult> {
  if (!UUID_PATTERN.test(id)) {
    const t = await getTranslations("Settings.errors");
    return { success: false, error: t("unknownDevice") };
  }

  try {
    await userServerFetch(`/auth/devices/${id}`, {
      method: "DELETE",
      headers: await deviceHeaders(),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}

/** Sign out every device except this one. */
export async function revokeOtherDevices(): Promise<DeviceActionResult> {
  try {
    await userServerFetch("/auth/devices/revoke-others", {
      method: "POST",
      headers: await deviceHeaders(),
    });
    return { success: true };
  } catch (err) {
    return toFailure(err);
  }
}
