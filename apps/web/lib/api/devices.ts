import "server-only";

import { userServerFetch } from "@/lib/api/user-client";
import { getUserDeviceId } from "@/lib/auth/session";
import type { LoginDevice } from "@/types/device";

/**
 * The signed-in user's active login devices. The mirrored device cookie is
 * forwarded so a legacy (no-`sid`) session can still be marked as current;
 * the JWT's `sid` is the primary signal on the backend.
 */
export async function listMyDevices(): Promise<LoginDevice[]> {
  const deviceId = await getUserDeviceId();
  const { data } = await userServerFetch<LoginDevice[]>("/auth/devices", {
    headers: deviceId ? { "x-device-id": deviceId } : undefined,
  });
  return data;
}
