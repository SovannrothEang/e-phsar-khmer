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

/**
 * Where does this device stand? Creates the account backup if none exists
 * yet (first device ever → it owns BK). A device that loses the creation
 * race, or any later new device, comes back `locked`.
 */
export async function ensureBackup(userId: string): Promise<BackupState> {
  const statusRes = await fetchBackupStatus();
  if (!statusRes.ok) return { kind: "error", message: statusRes.message };
  let status = statusRes.data;

  if (!status.exists) {
    const bk = newBackupKey();
    // Save locally BEFORE telling the server: a crash in between must never
    // leave the server pointing at a key no device holds.
    await saveBackupKey(userId, bk);
    const res = await initBackup(keyCheckOf(bk), keyProofOf(bk));
    if (!res.ok) return { kind: "error", message: res.message };
    status = res.data;
  }

  const bk = await localBackupKey(userId);
  return stateFrom(status, !!bk && keyCheckOf(bk) === status.keyCheck);
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
  bk: Uint8Array,
  fromCursor: string | undefined,
): Promise<number> {
  let cursor = fromCursor;
  let restored = 0;
  for (;;) {
    const page = await fetchBackupSegments(cursor);
    if (!page.ok) throw new Error(page.message);
    const items: PlaintextItem[] = [];
    for (const segment of page.data.items) {
      try {
        items.push(...openSegment(bk, segment.ciphertext));
      } catch {
        // A segment under a different/old key — skip, keep the rest.
      }
    }
    if (items.length > 0) await saveRestored(items);
    restored += items.length;
    cursor = page.data.latestCursor ?? cursor;
    if (!page.data.nextCursor) break;
  }

  const identity = await loadIdentity(userId);
  if (identity && cursor && identity.backupCursor !== cursor)
    await saveIdentity({ ...identity, backupCursor: cursor });

  if (restored > 0 && typeof window !== "undefined")
    window.dispatchEvent(new Event(E2E_HISTORY_RESTORED));
  return restored;
}

/** Incremental pull for a device that already holds BK. */
export async function pullBackup(userId: string): Promise<number> {
  const identity = await loadIdentity(userId);
  if (!identity?.backupKey) return 0;
  return pullFromBackup(
    userId,
    base64ToBytes(identity.backupKey),
    identity.backupCursor,
  );
}

async function adoptBackupKey(userId: string, bk: Uint8Array): Promise<number> {
  const status = await fetchBackupStatus();
  if (!status.ok) throw new Error(status.message);
  if (keyCheckOf(bk) !== status.data.keyCheck)
    throw new Error("backup key does not match this account");
  await saveBackupKey(userId, bk);
  return pullFromBackup(userId, bk, undefined); // full pull, from the start
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
    return { ok: true, restored: await adoptBackupKey(userId, bk) };
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
      await store.commitSessions([
        { peerKey: key, session: unwrapped.session },
      ]);
      return unwrapped.plaintext;
    });
    const restored = await adoptBackupKey(userId, bk);
    await consumeHistoryRequest(request.id, deviceId);
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
