import { createSignalEngine } from "./crypto/engine";
import type { RatchetEngine } from "./types";
import {
  generateIdentity,
  generateOneTimePrekeys,
  INITIAL_OTP_COUNT,
  loadIdentity,
  publicRegistrationPayload,
  REPLENISH_THRESHOLD,
  saveIdentity,
  toLocalKeyMaterial,
} from "./keys";
import type { StoredIdentity } from "./keys";
import { E2E_V2_ENABLED } from "./config";
import { deviceLabel } from "./device-label";
import {
  addE2eDevicePrekeys,
  fetchE2ePrekeyCount,
  heartbeatE2eDevice,
  registerE2eDevice,
  registerE2eKeys,
} from "@/actions/e2e";

/**
 * One engine promise per browser session, keyed by the signed-in account.
 * A userId change (login as someone else) drops the previous promise so the
 * next caller bootstraps the new account's material instead of reusing the
 * old engine.
 *
 * Keys are per (account, browser profile) and survive logout, so logging
 * back in on the same browser is the SAME device — device churn only comes
 * from genuinely new browser profiles (tasks/plan-e2e-multi-device.md).
 */
let engineUserId: string | null = null;
let enginePromise: Promise<RatchetEngine> | null = null;

export class E2eBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "E2eBootstrapError";
  }
}

async function loadOrCreateIdentity(userId: string): Promise<StoredIdentity> {
  const row = await loadIdentity(userId);
  if (row) return row;
  const fresh = generateIdentity(userId);
  await saveIdentity(fresh);
  return fresh;
}

/**
 * Generate + persist a fresh one-time prekey batch BEFORE uploading it: a
 * crash between upload and save would leave the server handing out public
 * prekeys whose private halves are gone, and every X3DH on them would fail.
 */
async function withNewPrekeyBatch(row: StoredIdentity) {
  const batch = generateOneTimePrekeys(row.nextPrekeyId, INITIAL_OTP_COUNT);
  const next: StoredIdentity = {
    ...row,
    oneTimePrekeys: [...row.oneTimePrekeys, ...batch],
    nextPrekeyId: row.nextPrekeyId + INITIAL_OTP_COUNT,
  };
  await saveIdentity(next);
  return { row: next, batch };
}

/** v1 (single device per account) — used only when the v2 flag is off. */
async function ensureRegisteredV1(
  row: StoredIdentity,
): Promise<StoredIdentity> {
  if (!row.registered) {
    const res = await registerE2eKeys(
      publicRegistrationPayload(row, row.oneTimePrekeys),
    );
    if (!res.ok)
      throw new E2eBootstrapError(`key registration failed: ${res.message}`);
    const registered = { ...row, registered: true };
    await saveIdentity(registered);
    return registered;
  }

  const countRes = await fetchE2ePrekeyCount();
  if (countRes.ok && countRes.data.available < REPLENISH_THRESHOLD) {
    const { row: next, batch } = await withNewPrekeyBatch(row);
    await registerE2eKeys(publicRegistrationPayload(next, batch));
    // Replenish failure is non-fatal — signed-prekey-only X3DH still works.
    return next;
  }
  return row;
}

/**
 * v2: make sure this browser is an active device. Known device → heartbeat
 * (keeps it in the active set, reports the prekey pool). Unknown or evicted
 * device → register-or-claim by identity key, which for a pre-multi-device
 * browser adopts the backfilled device holding its existing keys.
 */
async function ensureDevice(row: StoredIdentity): Promise<StoredIdentity> {
  if (row.deviceId) {
    const hb = await heartbeatE2eDevice(row.deviceId, deviceLabel());
    if (hb.ok) {
      if (hb.data.available < REPLENISH_THRESHOLD) {
        const { row: next, batch } = await withNewPrekeyBatch(row);
        await addE2eDevicePrekeys(
          row.deviceId,
          batch.map((p) => ({ prekeyId: p.id, publicKey: p.key.publicKey })),
        );
        return next;
      }
      return row;
    }
    // Transient failure: keep the known id — sends will 403 if it's really
    // gone and the next bootstrap retries. 404 = evicted: re-register below.
    if (hb.status !== 404) return row;
  }

  const { row: withBatch, batch } = await withNewPrekeyBatch(row);
  const res = await registerE2eDevice({
    ...publicRegistrationPayload(withBatch, batch),
    label: deviceLabel(),
  });
  if (!res.ok)
    throw new E2eBootstrapError(`device registration failed: ${res.message}`);
  const registered = { ...withBatch, deviceId: res.data.deviceId };
  await saveIdentity(registered);
  return registered;
}

async function bootstrap(userId: string): Promise<RatchetEngine> {
  if (typeof indexedDB === "undefined")
    throw new E2eBootstrapError("E2E requires a browser with IndexedDB");
  let row = await loadOrCreateIdentity(userId);
  row = E2E_V2_ENABLED
    ? await ensureDevice(row)
    : await ensureRegisteredV1(row);
  return createSignalEngine(toLocalKeyMaterial(row), {
    userId,
    // Kept even with the flag off, so already-received v2 messages still
    // decrypt after a rollback.
    deviceId: row.deviceId ?? null,
  });
}

/**
 * Get (and if needed bootstrap) the Signal engine for this account.
 * Concurrent callers share one in-flight promise; a different userId
 * invalidates it.
 */
export function getE2eEngine(userId: string): Promise<RatchetEngine> {
  if (enginePromise && engineUserId === userId) return enginePromise;
  engineUserId = userId;
  enginePromise = bootstrap(userId).catch((err) => {
    // Allow a retry on the next call instead of caching the failure.
    if (engineUserId === userId) {
      engineUserId = null;
      enginePromise = null;
    }
    throw err;
  });
  return enginePromise;
}

/** Drop the cached engine (e.g. on sign-out) so the next login re-bootstraps. */
export function resetE2eEngine(): void {
  engineUserId = null;
  enginePromise = null;
}
