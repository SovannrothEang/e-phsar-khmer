import { apiFetch } from "./client";

/**
 * Dev-only reachability check for the configured backend. Runs once at app
 * start so a wrong `EXPO_PUBLIC_API_URL` (the common phone-on-LAN mistake)
 * shows up in the Metro log instead of a silent empty screen.
 */
export async function probeApi(): Promise<boolean> {
  try {
    await apiFetch<unknown>("/categories", { auth: false });
    return true;
  } catch {
    return false;
  }
}
