import {
  approveHistoryRequest,
  consumeHistoryRequest,
  createHistoryRequest,
  declineHistoryRequest,
  fetchBackupSegments,
  fetchBackupStatus,
  fetchMyHistoryRequest,
  fetchPendingHistoryRequests,
  initBackup,
  setBackupPasscode,
  unlockBackup,
  uploadBackupSegment,
} from "@/actions/e2e-backup";
import type { BackupStatus, HistoryRequest } from "@/actions/e2e-backup";
import { fetchE2eDeviceBundle } from "@/actions/e2e";
import { base64ToBytes, bytesToBase64 } from "./crypto/base64";
import {
  DEFAULT_KDF,
  derivePasscodeKeys,
  keyCheckOf,
  keyProofOf,
  MIN_PASSCODE_LENGTH,
  newBackupKey,
  openSegment,
  randomBytes,
  sealSegment,
  segmentItemBytes,
  unwrapBackupKey,
  wrapBackupKey,
} from "./backup-crypto";
import { isNewSessionHeader } from "./decrypt-message";
import { loadIdentity, saveIdentity } from "./keys";
import { V2_LOCK, withConversationLock } from "./lock";
import {
  createIndexedDbStore,
  listLocalPlaintext,
  listUploadedIds,
  markUploaded,
  peerKey,
  saveRestored,
} from "./store";
import type { PlaintextItem } from "./store";
import type { RatchetEngine } from "./types";

/**
 * Chat-history backup flows (tasks/plan-e2e-multi-device.md, Phase 4/5).
 *
 * One backup key (BK) per account. Every device holding BK keeps uploading
 * its plaintext history as encrypted segments. A device WITHOUT BK (new
 * browser) gets it one of two ways:
 *   1. the account's backup passcode (primary), or
 *   2. an existing device approving it (fallback when the passcode isn't
 *      set or isn't known) — BK then travels over the device-to-device
 *      Double Ratchet session, like any message envelope.
 * Either way it then downloads the segments and history appears.
 */

/** Fired on `window` after restored plaintext lands — decrypt hooks re-run. */
export const E2E_HISTORY_RESTORED = "e2e-history-restored";

/**
 * Fired on `window` after newly decrypted plaintext is cached locally. The
 * backup sync listens so a fresh batch is uploaded right away instead of
 * waiting for the next 60 s tick.
 */
export const E2E_PLAINTEXT_CACHED = "e2e-plaintext-cached";

export type BackupState =
  | { kind: "ready"; hasPasscode: boolean }
  | { kind: "locked"; hasPasscode: boolean; lockedUntil: string | null }
  | { kind: "error"; message: string };

function stateFrom(status: BackupStatus, holdsKey: boolean): BackupState {
  return holdsKey
    ? { kind: "ready", hasPasscode: status.hasPasscode }
    : {
        kind: "locked",
        hasPasscode: status.hasPasscode,
        lockedUntil: status.lockedUntil,
      };
}

async function localBackupKey(userId: string): Promise<Uint8Array | null> {
  const identity = await loadIdentity(userId);
  return identity?.backupKey ? base64ToBytes(identity.backupKey) : null;
}

async function saveBackupKey(userId: string, bk: Uint8Array): Promise<void> {
  const identity = await loadIdentity(userId);
  if (!identity) throw new Error("no local identity");
  await saveIdentity({ ...identity, backupKey: bytesToBase64(bk) });
}

/** Drop the local BK (keeping the rest of the identity) — it is not usable. */
async function clearBackupKey(userId: string): Promise<void> {
  const identity = await loadIdentity(userId);
  if (!identity || identity.backupKey === undefined) return;
  await saveIdentity({ ...identity, backupKey: undefined });
}

/**
 * Cross-tab lock guarding backup creation: two first devices opening at the
 * same time must not both create a key — the loser's BK can never open the
 * account backup, so its uploads would be unreadable forever.
 */
const INIT_LOCK = "e2e-backup-init";
let initChain: Promise<unknown> = Promise.resolve();

function withInitLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    // lib.dom types the callback as returning T, not Promise<T> — it doesn't
    // model the (spec-correct) async-callback case (same note as lock.ts).
    return navigator.locks.request(INIT_LOCK, fn) as unknown as Promise<T>;
  }
  // No Web Locks (older browsers, test environments): serialize this tab.
  const run = initChain.then(fn, fn);
  initChain = run.catch(() => {});
  return run;
}

/**
 * Where does this device stand? Creates the account backup if none exists
 * yet (first device ever → it owns BK). A device that loses the creation
 * race, or any later new device, comes back `locked`.
 *
 * The whole status → create → re-read sequence runs under INIT_LOCK, so the
 * status read always reflects the winner of the race. Any stored BK is then
 * validated against the server's `keyCheck`: on mismatch it is cleared, never
 * used and never kept, and the device reports `locked`.
 */
export async function ensureBackup(
  userId: string,
  deviceId: string,
): Promise<BackupState> {
  return withInitLock(async () => {
    const statusRes = await fetchBackupStatus();
    if (!statusRes.ok) return { kind: "error", message: statusRes.message };
    let status = statusRes.data;

    if (!status.exists) {
      const bk = newBackupKey();
      // Save locally BEFORE telling the server: a crash in between must never
      // leave the server pointing at a key no device holds.
      await saveBackupKey(userId, bk);
      const res = await initBackup(deviceId, keyCheckOf(bk), keyProofOf(bk));
      if (!res.ok) return { kind: "error", message: res.message };
      status = res.data;
      if (!res.data.created) {
        // We lost the creation race: the account already had a BK this device
        // does not hold, so the key just saved can never open it. Drop it and
        // report locked so the device asks for approval instead.
        await clearBackupKey(userId);
        return stateFrom(status, false);
      }
    }

    const bk = await localBackupKey(userId);
    const keyCheck = status.keyCheck;
    if (bk && keyCheck !== null && keyCheckOf(bk) !== keyCheck) {
      // A stale key from an older backup, or another account's: never use it.
      await clearBackupKey(userId);
      return stateFrom(status, false);
    }
    return stateFrom(
      status,
      !!bk && keyCheck !== null && keyCheckOf(bk) === keyCheck,
    );
  });
}

// ── Upload (every device holding BK) ───────────────────────────────────────

const SEGMENT_MAX_ITEMS = 500;
/**
 * Plaintext JSON bytes per segment. Sealed + base64 that is ~4/3 × this
 * (~800 KB), under the backend's 900 KB ciphertext cap, its 1 MB JSON body
 * limit, and Next's 1 MB server-action limit. Counted in UTF-8 bytes, not
 * `.length`: Khmer/Chinese text is 3 bytes per UTF-16 unit, so a char count
 * under-sized segments by up to 3×.
 */
const SEGMENT_MAX_BYTES = 600_000;

let syncInFlight: Promise<number> | null = null;

/**
 * Push every plaintext this device has that isn't in the backup yet.
 * Serialized per tab; safe to call often (a no-op when nothing is new).
 * Returns the number of messages uploaded.
 */
export function syncBackup(userId: string, deviceId: string): Promise<number> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const bk = await localBackupKey(userId);
    if (!bk) return 0;
    const [local, uploaded] = await Promise.all([
      listLocalPlaintext(),
      listUploadedIds(),
    ]);
    const pending = local.filter((i) => !uploaded.has(i.messageId));

    let sent = 0;
    let batch: PlaintextItem[] = [];
    let bytes = 0;
    const flush = async () => {
      if (batch.length === 0) return;
      const res = await uploadBackupSegment({
        deviceId,
        ciphertext: sealSegment(bk, batch),
        messageCount: batch.length,
      });
      if (!res.ok) throw new Error(res.message);
      await markUploaded(batch.map((i) => i.messageId));
      sent += batch.length;
      batch = [];
      bytes = 0;
    };
    for (const item of pending) {
      const itemBytes = segmentItemBytes(item);
      if (
        batch.length >= SEGMENT_MAX_ITEMS ||
        bytes + itemBytes > SEGMENT_MAX_BYTES
      )
        await flush();
      batch.push(item);
      bytes += itemBytes;
    }
    await flush();
    return sent;
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

// ── Download (after obtaining BK) ──────────────────────────────────────────

/**
 * Pull segments newer than this device's saved cursor into `restored`.
 * Runs once in full after obtaining BK, then incrementally on every sync —
 * so history another device uploads LATER (e.g. an old browser that joins
 * the backup after this one) still shows up here. Returns messages pulled.
 */
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
    if (!page.ok) throw new Error(page.message);
    const items: PlaintextItem[] = [];
    let unreadable = false;
    for (const segment of page.data.items) {
      try {
        items.push(...openSegment(bk, segment.ciphertext));
      } catch {
        // A segment under a different/old key — keep what opened, but the
        // cursor must NOT advance past this page: skipping it would silently
        // lose every readable segment after it. Retry once this device has
        // the right BK (passcode or another device's approval).
        unreadable = true;
      }
    }
    if (items.length > 0) await saveRestored(items);
    restored += items.length;
    if (unreadable) {
      console.warn(
        "[e2e] backup segment could not be opened; not advancing cursor",
      );
      break;
    }
    cursor = page.data.latestCursor ?? cursor;
    if (!page.data.nextCursor) break;
  }

  // Only the last fully-readable page's cursor is persisted, so a retry
  // re-fetches the unreadable page.
  const identity = await loadIdentity(userId);
  if (identity && cursor && identity.backupCursor !== cursor)
    await saveIdentity({ ...identity, backupCursor: cursor });

  if (restored > 0 && typeof window !== "undefined")
    window.dispatchEvent(new Event(E2E_HISTORY_RESTORED));
  return restored;
}

/**
 * Incremental pull for a device that already holds BK. The stored key is
 * validated against the account first: a stale/mismatched key is cleared and
 * nothing is pulled (the device is treated as locked on the next status read).
 */
export async function pullBackup(
  userId: string,
  deviceId: string,
): Promise<number> {
  const identity = await loadIdentity(userId);
  if (!identity?.backupKey) return 0;
  const bk = base64ToBytes(identity.backupKey);
  const status = await fetchBackupStatus();
  if (!status.ok) throw new Error(status.message);
  if (!status.data.keyCheck || keyCheckOf(bk) !== status.data.keyCheck) {
    await clearBackupKey(userId);
    return 0;
  }
  return pullFromBackup(userId, deviceId, bk, identity.backupCursor);
}

async function adoptBackupKey(
  userId: string,
  deviceId: string,
  bk: Uint8Array,
): Promise<number> {
  const status = await fetchBackupStatus();
  if (!status.ok) throw new Error(status.message);
  if (!status.data.keyCheck || keyCheckOf(bk) !== status.data.keyCheck)
    throw new Error("backup key does not match this account");
  await saveBackupKey(userId, bk);
  return pullFromBackup(userId, deviceId, bk, undefined); // full pull, from the start
}

// ── Passcode ────────────────────────────────────────────────────────────────

export type PasscodeResult =
  | { ok: true; restored: number }
  | { ok: false; reason: "wrong"; attemptsLeft: number }
  | { ok: false; reason: "locked"; lockedUntil: string | null }
  | { ok: false; reason: "no-passcode" }
  | { ok: false; reason: "error"; message: string };

export async function restoreWithPasscode(
  userId: string,
  deviceId: string,
  passcode: string,
): Promise<PasscodeResult> {
  const status = await fetchBackupStatus();
  if (!status.ok)
    return { ok: false, reason: "error", message: status.message };
  const { passcodeSalt, passcodeParams, hasPasscode } = status.data;
  if (!hasPasscode || !passcodeSalt || !passcodeParams)
    return { ok: false, reason: "no-passcode" };

  const { wrapKey, authKey } = await derivePasscodeKeys(
    passcode,
    passcodeSalt,
    passcodeParams,
  );
  const unlock = await unlockBackup(authKey);
  if (!unlock.ok) {
    const details = (unlock.details ?? {}) as {
      attemptsLeft?: number;
      lockedUntil?: string | null;
    };
    if (unlock.code === "E2E_PASSCODE_WRONG")
      return details.lockedUntil
        ? { ok: false, reason: "locked", lockedUntil: details.lockedUntil }
        : {
            ok: false,
            reason: "wrong",
            attemptsLeft: details.attemptsLeft ?? 0,
          };
    if (unlock.code === "E2E_PASSCODE_LOCKED")
      return {
        ok: false,
        reason: "locked",
        lockedUntil: details.lockedUntil ?? null,
      };
    if (unlock.code === "E2E_NO_PASSCODE")
      return { ok: false, reason: "no-passcode" };
    return { ok: false, reason: "error", message: unlock.message };
  }

  try {
    const bk = unwrapBackupKey(wrapKey, unlock.data.wrappedKey);
    return {
      ok: true,
      restored: await adoptBackupKey(userId, deviceId, bk),
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "restore failed",
    };
  }
}

/** Set or change the passcode. Only a device already holding BK can. */
export async function setPasscode(
  userId: string,
  passcode: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (passcode.length < MIN_PASSCODE_LENGTH)
    return { ok: false, message: "too-short" };
  const bk = await localBackupKey(userId);
  if (!bk) return { ok: false, message: "no-backup-key" };

  const salt = bytesToBase64(randomBytes(16));
  const { wrapKey, authKey } = await derivePasscodeKeys(
    passcode,
    salt,
    DEFAULT_KDF,
  );
  const res = await setBackupPasscode({
    keyCheck: keyCheckOf(bk),
    keyProof: keyProofOf(bk),
    salt,
    params: DEFAULT_KDF,
    wrappedKey: wrapBackupKey(wrapKey, bk),
    authKey,
  });
  return res.ok ? { ok: true } : { ok: false, message: res.message };
}

// ── Approval by another device ─────────────────────────────────────────────

export function requestApproval(engine: RatchetEngine) {
  if (!engine.deviceId) throw new Error("device not registered");
  return createHistoryRequest(engine.deviceId);
}

/**
 * Requester side: poll this device's request. Once approved, unwrap BK from
 * the approver's envelope (same Double Ratchet session the two devices use
 * for chat), adopt it, restore, and tell the server to drop the copy.
 */
export async function checkApproval(
  engine: RatchetEngine,
): Promise<
  | { status: "none" | "pending" | "declined" | "expired" }
  | { status: "restored"; restored: number }
  | { status: "error"; message: string }
> {
  if (!engine.userId || !engine.deviceId)
    return { status: "error", message: "device not registered" };
  const userId = engine.userId;
  const deviceId = engine.deviceId;

  const res = await fetchMyHistoryRequest(deviceId);
  if (!res.ok) return { status: "error", message: res.message };
  const request = res.data;
  if (!request) return { status: "none" };
  if (request.status === "pending") return { status: "pending" };
  if (request.status === "declined" || request.status === "expired")
    return { status: request.status };
  if (
    request.status !== "approved" ||
    !request.header ||
    !request.wrappedKey ||
    !request.approverDeviceId
  )
    return { status: "none" };

  const header = request.header;
  const wrappedKey = request.wrappedKey;
  const key = peerKey(userId, request.approverDeviceId);
  const store = createIndexedDbStore();
  try {
    const bk = await withConversationLock(V2_LOCK, async () => {
      const session = isNewSessionHeader(header)
        ? null
        : await store.getDeviceSession(key);
      const unwrapped = await engine.decryptBytes(session, header, wrappedKey);
      // Validate and persist the received BK BEFORE advancing the ratchet and
      // BEFORE consuming the request. If either step fails here the request
      // stays approved and retryable, and no one-shot session state is lost.
      const status = await fetchBackupStatus();
      if (!status.ok) throw new Error(status.message);
      if (
        !status.data.keyCheck ||
        keyCheckOf(unwrapped.plaintext) !== status.data.keyCheck
      )
        throw new Error("backup key does not match this account");
      await saveBackupKey(userId, unwrapped.plaintext);
      // Only now advance our side of the ratchet — the envelope is one-shot.
      await store.commitSessions([
        { peerKey: key, session: unwrapped.session },
      ]);
      return unwrapped.plaintext;
    });

    // The BK is local from here on, so the approved request can never be
    // stranded: consuming and pulling are best-effort, and a later pullBackup
    // finishes a pull that failed.
    const consumed = await consumeHistoryRequest(request.id, deviceId);
    if (!consumed.ok)
      console.warn(
        "[e2e] could not consume the approved history request",
        consumed.message,
      );
    let restored = 0;
    try {
      restored = await pullFromBackup(userId, deviceId, bk, undefined);
    } catch (err) {
      console.warn("[e2e] backup pull after approval failed; will retry", err);
    }
    return { status: "restored", restored };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "approval failed",
    };
  }
}

/** Approver side: other devices' requests waiting on this one. */
export async function listPendingApprovals(
  engine: RatchetEngine,
): Promise<HistoryRequest[]> {
  if (!engine.deviceId) return [];
  const res = await fetchPendingHistoryRequests(engine.deviceId);
  return res.ok ? res.data : [];
}

/** Approver side: send BK to the requesting device over its E2E session. */
export async function approveRequest(
  engine: RatchetEngine,
  request: HistoryRequest,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!engine.userId || !engine.deviceId)
    return { ok: false, message: "device not registered" };
  const userId = engine.userId;
  const approverDeviceId = engine.deviceId;
  const bk = await localBackupKey(userId);
  if (!bk) return { ok: false, message: "no-backup-key" };

  const key = peerKey(userId, request.requesterDeviceId);
  const store = createIndexedDbStore();
  return withConversationLock(V2_LOCK, async () => {
    const session = await store.getDeviceSession(key);
    let bundle;
    if (!session) {
      const b = await fetchE2eDeviceBundle(request.requesterDeviceId);
      if (!b.ok) return { ok: false as const, message: b.message };
      bundle = b.data;
    }
    const wrapped = await engine.encryptBytes(session, bk, bundle);
    const res = await approveHistoryRequest(request.id, {
      approverDeviceId,
      header: wrapped.header,
      wrappedKey: wrapped.ciphertext,
    });
    if (!res.ok) return { ok: false as const, message: res.message };
    // Advance our side only once the server holds the envelope.
    await store.commitSessions([{ peerKey: key, session: wrapped.session }]);
    return { ok: true as const };
  });
}

export async function declineRequest(
  engine: RatchetEngine,
  request: HistoryRequest,
): Promise<void> {
  if (engine.deviceId) await declineHistoryRequest(request.id, engine.deviceId);
}
