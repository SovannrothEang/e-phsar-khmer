import {
  fetchBackupSegments,
  fetchBackupStatus,
  unlockBackup,
} from "@/lib/api/backup";
import { ApiError } from "@/lib/api/client";
import {
  derivePasscodeKeys,
  keyCheckOf,
  openSegments,
  unwrapBackupKey,
} from "./backup-crypto";
import { base64ToBytes, bytesToBase64 } from "./crypto/base64";
import { loadIdentity, saveIdentity, saveRestored } from "./store";

export type RestoreResult =
  | { ok: true; restored: number }
  | { ok: false; reason: "wrong"; attemptsLeft: number }
  | { ok: false; reason: "locked"; lockedUntil: string | null }
  | { ok: false; reason: "no-passcode" }
  | { ok: false; reason: "no-backup" }
  | { ok: false; reason: "error"; message: string };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Restore failed";
}

/**
 * A new device obtains the account's backup key with the passcode, validates
 * it against the public `keyCheck`, then pulls every segment into the
 * restored-plaintext cache. Mirrors the web's `restoreWithPasscode`.
 */
export async function restoreWithPasscode(
  userId: string,
  deviceId: string,
  passcode: string,
): Promise<RestoreResult> {
  try {
    const status = await fetchBackupStatus();
    if (!status.exists) return { ok: false, reason: "no-backup" };
    if (!status.hasPasscode || !status.passcodeSalt || !status.passcodeParams) {
      return { ok: false, reason: "no-passcode" };
    }
    if (
      status.lockedUntil &&
      new Date(status.lockedUntil).getTime() > Date.now()
    ) {
      return { ok: false, reason: "locked", lockedUntil: status.lockedUntil };
    }

    const { wrapKey, authKey } = await derivePasscodeKeys(
      passcode,
      status.passcodeSalt,
      status.passcodeParams,
    );

    let unlocked: { wrappedKey: string };
    try {
      unlocked = await unlockBackup(authKey);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        return {
          ok: false,
          reason: "error",
          message: "Network error. Please try again.",
        };
      }
      const details = (error.details ?? {}) as {
        attemptsLeft?: number;
        lockedUntil?: string | null;
      };
      if (error.code === "E2E_PASSCODE_WRONG") {
        return details.lockedUntil
          ? { ok: false, reason: "locked", lockedUntil: details.lockedUntil }
          : {
              ok: false,
              reason: "wrong",
              attemptsLeft: details.attemptsLeft ?? 0,
            };
      }
      if (error.code === "E2E_PASSCODE_LOCKED") {
        return {
          ok: false,
          reason: "locked",
          lockedUntil: details.lockedUntil ?? null,
        };
      }
      if (error.code === "E2E_NO_PASSCODE") {
        return { ok: false, reason: "no-passcode" };
      }
      return { ok: false, reason: "error", message: error.message };
    }

    const bk = unwrapBackupKey(wrapKey, unlocked.wrappedKey);
    if (!status.keyCheck || keyCheckOf(bk) !== status.keyCheck) {
      return {
        ok: false,
        reason: "error",
        message: "The backup key does not match this account.",
      };
    }

    const identity = await loadIdentity(userId);
    if (!identity) {
      return {
        ok: false,
        reason: "error",
        message: "Chat encryption is not set up yet.",
      };
    }

    await saveIdentity({
      ...identity,
      backupKey: bytesToBase64(bk),
      backupCursor: undefined,
    });

    const restored = await pullFromBackup(userId, deviceId, bk, undefined);
    return { ok: true, restored };
  } catch (error) {
    return { ok: false, reason: "error", message: errorMessage(error) };
  }
}

/** Incremental pull for a device that already holds BK (best effort). */
export async function pullBackup(
  userId: string,
  deviceId: string,
): Promise<number> {
  const identity = await loadIdentity(userId);
  if (!identity?.backupKey || !deviceId) return 0;
  try {
    const bk = base64ToBytes(identity.backupKey);
    const status = await fetchBackupStatus();
    if (!status.keyCheck || keyCheckOf(bk) !== status.keyCheck) return 0;
    return await pullFromBackup(userId, deviceId, bk, identity.backupCursor);
  } catch {
    return 0;
  }
}

async function pullFromBackup(
  userId: string,
  deviceId: string,
  bk: Uint8Array,
  fromCursor: string | undefined,
): Promise<number> {
  let cursor = fromCursor;
  let restored = 0;

  for (;;) {
    const page = await fetchBackupSegments(deviceId, cursor);
    // The key was validated against keyCheck first, so an unopenable segment
    // is corrupt/foreign — skip it, never stop the pull at it.
    const items = openSegments(page.items, bk);
    if (items.length > 0) await saveRestored(items);
    restored += items.length;

    cursor = page.latestCursor ?? cursor;
    if (!page.nextCursor) break;
  }

  const identity = await loadIdentity(userId);
  if (identity && cursor && identity.backupCursor !== cursor) {
    await saveIdentity({ ...identity, backupCursor: cursor });
  }
  return restored;
}
