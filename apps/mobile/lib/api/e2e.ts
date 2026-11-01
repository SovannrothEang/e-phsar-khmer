import { apiFetch } from "@/lib/api/client";
import type { RemoteKeyBundle } from "@/lib/e2e/types";

export interface RegistrationPayload {
  identityKey: string;
  identitySigningKey: string;
  registrationId: number;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekeys: { prekeyId: number; publicKey: string }[];
  label?: string;
}

export interface E2eDeviceBundle extends RemoteKeyBundle {
  deviceId: string;
  userId: string;
}

/** Register-or-claim this device by identity key; returns the device id. */
export async function registerE2eDevice(
  payload: RegistrationPayload,
): Promise<{ deviceId: string }> {
  const { data } = await apiFetch<{ deviceId: string }>("/chats/e2e/devices", {
    method: "POST",
    body: payload,
  });
  return data;
}

/** Keeps the device in the active set; 404 means it was evicted. */
export async function heartbeatE2eDevice(
  deviceId: string,
  label?: string,
): Promise<{ available: number }> {
  const { data } = await apiFetch<{ available: number }>(
    `/chats/e2e/devices/${encodeURIComponent(deviceId)}/heartbeat`,
    { method: "POST", body: label ? { label } : {} },
  );
  return data;
}

export async function addE2eDevicePrekeys(
  deviceId: string,
  prekeys: { prekeyId: number; publicKey: string }[],
): Promise<{ accepted: number }> {
  const { data } = await apiFetch<{ accepted: number }>(
    `/chats/e2e/devices/${encodeURIComponent(deviceId)}/prekeys`,
    { method: "POST", body: { oneTimePrekeys: prekeys } },
  );
  return data;
}

/** The active device ids a sender must address with envelopes. */
export async function fetchE2eUserDevices(userId: string): Promise<string[]> {
  const { data } = await apiFetch<string[]>(
    `/chats/e2e/users/${encodeURIComponent(userId)}/devices`,
  );
  return data ?? [];
}

/** Public key bundle for one device (claims one one-time prekey). */
export async function fetchE2eDeviceBundle(
  deviceId: string,
): Promise<E2eDeviceBundle> {
  const { data } = await apiFetch<E2eDeviceBundle>(
    `/chats/e2e/devices/${encodeURIComponent(deviceId)}/bundle`,
  );
  return data;
}
