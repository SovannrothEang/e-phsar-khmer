"use server";

import { userServerFetch, ApiError } from "@/lib/api/user-client";
import type { ChatActionResult } from "@/types/chat";

/**
 * Server actions for the E2E key-directory endpoints. Public key material
 * only — private keys never cross this boundary (spec design §9).
 */

export interface RegisterE2eKeysInput {
  identityKey: string;
  identitySigningKey: string;
  registrationId: number;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekeys: { prekeyId: number; publicKey: string }[];
}

export interface E2eKeyBundle {
  identityKey: string;
  identitySigningKey: string;
  registrationId: number;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekey: { prekeyId: number; publicKey: string } | null;
}

function toFailure(err: unknown): ChatActionResult<never> {
  if (err instanceof ApiError) {
    return {
      ok: false,
      status: err.status,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }
  return {
    ok: false,
    status: 0,
    code: "NETWORK_ERROR",
    message: "Network error",
  };
}

/** POST /chats/e2e/keys — upsert identity + signed prekey, insert new OTKs. */
export async function registerE2eKeys(
  input: RegisterE2eKeysInput,
): Promise<ChatActionResult<{ accepted: number }>> {
  try {
    const { data } = await userServerFetch<{ accepted: number }>(
      "/chats/e2e/keys",
      { method: "POST", body: JSON.stringify(input) },
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/** GET /chats/e2e/keys/:userId/bundle — 404 when the peer has no keys. */
export async function fetchE2eKeyBundle(
  userId: string,
): Promise<ChatActionResult<E2eKeyBundle>> {
  try {
    const { data } = await userServerFetch<E2eKeyBundle>(
      `/chats/e2e/keys/${userId}/bundle`,
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

// ── Multi-device (v2) ───────────────────────────────────────────────────────

export interface E2eDeviceBundle extends E2eKeyBundle {
  deviceId: string;
  userId: string;
}

/** POST /chats/e2e/devices — register, or claim the device with this identity key. */
export async function registerE2eDevice(
  input: RegisterE2eKeysInput & { label?: string },
): Promise<ChatActionResult<{ deviceId: string }>> {
  try {
    const { data } = await userServerFetch<{ deviceId: string }>(
      "/chats/e2e/devices",
      { method: "POST", body: JSON.stringify(input) },
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/** POST /chats/e2e/devices/:id/heartbeat — keeps the device active; 404 = re-register. */
export async function heartbeatE2eDevice(
  deviceId: string,
  label?: string,
): Promise<ChatActionResult<{ available: number }>> {
  try {
    const { data } = await userServerFetch<{ available: number }>(
      `/chats/e2e/devices/${deviceId}/heartbeat`,
      { method: "POST", body: JSON.stringify({ label }) },
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/** POST /chats/e2e/devices/:id/prekeys — replenish one-time prekeys. */
export async function addE2eDevicePrekeys(
  deviceId: string,
  oneTimePrekeys: RegisterE2eKeysInput["oneTimePrekeys"],
): Promise<ChatActionResult<{ accepted: number }>> {
  try {
    const { data } = await userServerFetch<{ accepted: number }>(
      `/chats/e2e/devices/${deviceId}/prekeys`,
      { method: "POST", body: JSON.stringify({ oneTimePrekeys }) },
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/** GET /chats/e2e/users/:userId/devices — active device ids to encrypt to. */
export async function fetchE2eUserDevices(
  userId: string,
): Promise<ChatActionResult<string[]>> {
  try {
    const { data } = await userServerFetch<string[]>(
      `/chats/e2e/users/${userId}/devices`,
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/** GET /chats/e2e/devices/:id/bundle — claims one of that device's one-time prekeys. */
export async function fetchE2eDeviceBundle(
  deviceId: string,
): Promise<ChatActionResult<E2eDeviceBundle>> {
  try {
    const { data } = await userServerFetch<E2eDeviceBundle>(
      `/chats/e2e/devices/${deviceId}/bundle`,
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/** GET /chats/e2e/keys/me/prekey-count — drives local replenish. */
export async function fetchE2ePrekeyCount(): Promise<
  ChatActionResult<{ available: number }>
> {
  try {
    const { data } = await userServerFetch<{ available: number }>(
      "/chats/e2e/keys/me/prekey-count",
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}
