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
import { fetchE2ePrekeyCount, registerE2eKeys } from "@/actions/e2e";

/**
 * One engine promise per browser session, keyed by the signed-in account.
 * A userId change (login as someone else) drops the previous promise so the
 * next caller bootstraps the new account's material instead of reusing the
 * old engine (spec decision #2 — single device per identity).
 */
let engineUserId: string | null = null;
let enginePromise: Promise<RatchetEngine> | null = null;

export class E2eBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "E2eBootstrapError";
  }
}

async function ensureRegistered(userId: string) {
  let row = await loadIdentity(userId);
  if (!row) {
    row = generateIdentity(userId);
    await saveIdentity(row);
  }

  // First-time identity (or a previous POST failed): upload everything.
  if (!row.registered) {
    const res = await registerE2eKeys(
      publicRegistrationPayload(row, row.oneTimePrekeys),
    );
    if (!res.ok)
      throw new E2eBootstrapError(`key registration failed: ${res.message}`);
    row = { ...row, registered: true };
    await saveIdentity(row);
    return row;
  }

  // Steady state: top the pool back up before it hits zero (decision #7).
  const countRes = await fetchE2ePrekeyCount();
  if (countRes.ok && countRes.data.available < REPLENISH_THRESHOLD) {
    const batch = generateOneTimePrekeys(row.nextPrekeyId, INITIAL_OTP_COUNT);
    const res = await registerE2eKeys(publicRegistrationPayload(row, batch));
    if (res.ok) {
      row = {
        ...row,
        oneTimePrekeys: [...row.oneTimePrekeys, ...batch],
        nextPrekeyId: row.nextPrekeyId + INITIAL_OTP_COUNT,
      };
      await saveIdentity(row);
    }
    // Replenish failure is non-fatal — signed-prekey-only X3DH still works.
  }
  return row;
}

async function bootstrap(userId: string): Promise<RatchetEngine> {
  if (typeof indexedDB === "undefined")
    throw new E2eBootstrapError("E2E requires a browser with IndexedDB");
  const row = await ensureRegistered(userId);
  return createSignalEngine(toLocalKeyMaterial(row));
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
