import * as Device from "expo-device";
import { Platform } from "react-native";
import {
  addE2eDevicePrekeys,
  heartbeatE2eDevice,
  registerE2eDevice,
} from "@/lib/api/e2e";
import { ApiError } from "@/lib/api/client";
import { createSignalEngine } from "./crypto/engine";
import {
  INITIAL_OTP_COUNT,
  REPLENISH_THRESHOLD,
  generateIdentity,
  generatePrekeys,
  localKeyMaterial,
  publicRegistrationPayload,
} from "./keys";
import {
  loadIdentity,
  loadPrekey,
  saveIdentity,
  savePrekeys,
  type StoredIdentity,
  type StoredPrekey,
} from "./store";
import type { RatchetEngine } from "./types";

export function deviceLabel(): string {
  const model =
    Device.modelName ??
    (Platform.OS === "ios"
      ? "iPhone"
      : Platform.OS === "android"
        ? "Android phone"
        : "Device");
  const osName = Device.osName ?? (Platform.OS === "ios" ? "iOS" : Platform.OS);
  const osVersion = Device.osVersion ? ` ${Device.osVersion}` : "";
  return `${model} · ${osName}${osVersion}`;
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

async function loadAllPrekeys(
  identity: StoredIdentity,
): Promise<Map<number, StoredPrekey>> {
  const ids = Array.from(
    { length: Math.max(0, identity.nextPrekeyId - 1) },
    (_, index) => index + 1,
  );
  const prefetched = await Promise.all(
    ids.map(async (id) => [id, await loadPrekey(identity.userId, id)] as const),
  );
  const map = new Map<number, StoredPrekey>();
  for (const [id, prekey] of prefetched) {
    if (prekey) map.set(id, prekey);
  }
  return map;
}

/**
 * Mirrors the web's `ensureDevice`: heartbeat keeps this device in the active
 * set; 404 means it was evicted (max 5 devices) and re-registers by identity
 * key; a low one-time-prekey pool tops up. Any transient failure keeps the
 * known device id — the next bootstrap or send retries.
 */
async function ensureDevice(identity: StoredIdentity): Promise<StoredIdentity> {
  if (identity.deviceId) {
    try {
      const heartbeat = await heartbeatE2eDevice(
        identity.deviceId,
        deviceLabel(),
      );
      if (heartbeat.available >= REPLENISH_THRESHOLD) return identity;

      const batch = generatePrekeys(identity.nextPrekeyId, INITIAL_OTP_COUNT);
      const next: StoredIdentity = {
        ...identity,
        nextPrekeyId: identity.nextPrekeyId + INITIAL_OTP_COUNT,
      };
      // Persist private halves before their public halves leave the device.
      await savePrekeys(identity.userId, batch);
      await saveIdentity(next);
      await addE2eDevicePrekeys(
        identity.deviceId,
        batch.map((prekey) => ({
          prekeyId: prekey.id,
          publicKey: prekey.key.publicKey,
        })),
      ).catch(() => undefined);
      return next;
    } catch (error) {
      if (!isNotFound(error)) return identity;
      // Evicted: fall through and register-or-claim this identity again.
    }
  }

  // A brand-new identity already has its first batch stored but never
  // uploaded; a previously registered identity (evicted) needs a fresh batch.
  const wasRegistered = Boolean(identity.deviceId);
  let batch: StoredPrekey[];
  let next: StoredIdentity;

  if (wasRegistered) {
    batch = generatePrekeys(identity.nextPrekeyId, INITIAL_OTP_COUNT);
    next = {
      ...identity,
      nextPrekeyId: identity.nextPrekeyId + INITIAL_OTP_COUNT,
    };
    await savePrekeys(identity.userId, batch);
    await saveIdentity(next);
  } else {
    const stored = await loadAllPrekeys(identity);
    batch = [...stored.values()];
    next = identity;
  }

  const registered = await registerE2eDevice(
    publicRegistrationPayload(next, batch, deviceLabel()),
  );
  const registeredIdentity: StoredIdentity = {
    ...next,
    deviceId: registered.deviceId,
  };
  await saveIdentity(registeredIdentity);
  return registeredIdentity;
}

async function buildEngine(identity: StoredIdentity): Promise<RatchetEngine> {
  const prekeys = await loadAllPrekeys(identity);
  return createSignalEngine(localKeyMaterial(identity, prekeys), {
    userId: identity.userId,
    deviceId: identity.deviceId ?? null,
  });
}

const enginePromises = new Map<string, Promise<RatchetEngine>>();

/**
 * One engine per account per app process. The first call performs the whole
 * bootstrap (identity → device registration/heartbeat → prekey prefetch); the
 * chat screen awaits this and shows a "preparing encryption" state.
 */
export function getE2eEngine(userId: string): Promise<RatchetEngine> {
  const existing = enginePromises.get(userId);
  if (existing) return existing;

  const promise = bootstrap(userId).catch((error) => {
    enginePromises.delete(userId);
    throw error;
  });
  enginePromises.set(userId, promise);
  return promise;
}

async function bootstrap(userId: string): Promise<RatchetEngine> {
  let identity = await loadIdentity(userId);
  if (!identity) {
    const generated = generateIdentity(userId);
    await saveIdentity(generated.identity);
    await savePrekeys(userId, generated.prekeys);
    identity = generated.identity;
  }
  identity = await ensureDevice(identity);
  return buildEngine(identity);
}

/** Drop in-memory engines on logout; identity material stays in SecureStore. */
export function clearE2eEngines(): void {
  enginePromises.clear();
}

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

/** Fire-and-forget bootstrap after login; the chat screen retries on demand. */
export function bootstrapE2eAfterAuth(userId: string): void {
  let failures = 0;
  const attempt = () => {
    getE2eEngine(userId).catch((error: unknown) => {
      if (failures >= RETRY_DELAYS_MS.length) {
        console.warn("[e2e] device bootstrap failed", error);
        return;
      }
      setTimeout(attempt, RETRY_DELAYS_MS[failures]);
      failures += 1;
    });
  };
  attempt();
}
