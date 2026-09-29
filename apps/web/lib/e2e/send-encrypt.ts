import {
  fetchE2eDeviceBundle,
  fetchE2eKeyBundle,
  fetchE2eUserDevices,
} from "@/actions/e2e";
import type {
  E2eEnvelope,
  SendMessageInput,
  SendMessageResult,
} from "@/types/chat";
import type { ChatActionResult } from "@/types/chat";
import { E2E_V2_ENABLED } from "./config";
import { sealBody } from "./content";
import { resetE2eEngine } from "./engine-provider";
import { V2_LOCK, withConversationLock } from "./lock";
import { createIndexedDbStore, peerKey } from "./store";
import type { RatchetEngine, RatchetSession } from "./types";

/** Fail-closed markers the send path surfaces as user-facing errors. */
export type E2eSendFailure =
  | { ok: false; reason: "no-recipient-keys" }
  | { ok: false; reason: "engine-unavailable" }
  | { ok: false; reason: "encrypt-failed"; message: string }
  | { ok: false; reason: "send-failed"; message: string; status: number };

export type E2eSendSuccess = {
  ok: true;
  result: SendMessageResult;
};

export type E2eSendOutcome = E2eSendSuccess | E2eSendFailure;

export interface E2eSendOptions {
  conversationId: string | null;
  /** The signed-in user — v2 also encrypts to their other devices. */
  senderId: string;
  recipientId: string;
  plaintext: string;
  listingId?: string;
  /**
   * Stable dedup key from the optimistic echo — pass through on every
   * retry so a lost HTTP response cannot insert twice.
   */
  clientMessageId?: string;
  send: (
    input: SendMessageInput,
  ) => Promise<ChatActionResult<SendMessageResult>>;
}

/**
 * Encrypt one text body and deliver it, with ratchet session state
 * committed only after the server accepts the ciphertext.
 *
 * Always uses the HTTP path even when a WebSocket is connected — the session
 * commit needs `conversationId` + `message.id` from the send response, which
 * the fire-and-forget WS envelope does not carry.
 */
export async function sendE2eText(
  engine: RatchetEngine | null,
  opts: E2eSendOptions,
): Promise<E2eSendOutcome> {
  if (!engine) return { ok: false, reason: "engine-unavailable" };
  try {
    return E2E_V2_ENABLED && engine.deviceId
      ? await sendV2(engine, engine.deviceId, opts)
      : await sendV1(engine, opts);
  } catch (err) {
    return {
      ok: false,
      reason: "encrypt-failed",
      message: err instanceof Error ? err.message : "encrypt failed",
    };
  }
}

// ── v1: one session per conversation, recipient's single identity ─────────

/**
 * The whole encrypt → send → commit sequence runs under the per-conversation
 * Web Lock: releasing it after encrypt (and re-acquiring for commit) would
 * let a second tab encrypt from the stale session in between, permanently
 * desyncing the chain.
 */
function sendV1(
  engine: RatchetEngine,
  opts: E2eSendOptions,
): Promise<E2eSendOutcome> {
  const store = createIndexedDbStore();
  const lockKey = opts.conversationId ?? `new-${opts.recipientId}`;

  return withConversationLock(lockKey, async (): Promise<E2eSendOutcome> => {
    let session = opts.conversationId
      ? await store.getSession(opts.conversationId)
      : null;

    // Two attempts: the second only after a 409 E2E_SESSION_STALE, i.e. the
    // recipient re-registered keys since our session was built.
    for (let attempt = 0; attempt < 2; attempt++) {
      let bundle;
      if (!session) {
        const res = await fetchE2eKeyBundle(opts.recipientId);
        // 404 = peer has never bootstrapped keys — refuse, no plaintext
        // fallback (spec decision #6).
        if (!res.ok) {
          if (res.status === 404)
            return { ok: false, reason: "no-recipient-keys" };
          return { ok: false, reason: "encrypt-failed", message: res.message };
        }
        bundle = res.data;
      }

      const encrypted = await engine.encrypt(session, opts.plaintext, bundle);
      const sendRes = await opts.send({
        recipientId: opts.recipientId,
        body: encrypted.ciphertext,
        e2eHeader: encrypted.header,
        recipientIdentityKey: encrypted.remoteIdentityKey,
        listingId: opts.listingId,
        clientMessageId: opts.clientMessageId,
      });

      if (!sendRes.ok) {
        if (sendRes.code === "E2E_SESSION_STALE" && attempt === 0) {
          session = null; // restart against the recipient's current keys
          continue;
        }
        return {
          ok: false,
          reason: "send-failed",
          message: sendRes.message,
          status: sendRes.status,
        };
      }

      // Session advanced only now that the ciphertext is durable server-side.
      const conversationId = opts.conversationId ?? sendRes.data.conversationId;
      await store.commit(
        conversationId,
        encrypted.session,
        sendRes.data.message.id,
        opts.plaintext,
      );
      return { ok: true, result: sendRes.data };
    }
    return {
      ok: false,
      reason: "send-failed",
      message: "Recipient keys keep changing",
      status: 409,
    };
  });
}

// ── v2: one session per peer device, content key wrapped per device ────────

/**
 * Device lists per user, cached for the tab's lifetime. The server is the
 * source of truth: any drift comes back as a 409 E2E_DEVICES_MISMATCH that
 * patches this cache, so steady-state sends cost zero extra round trips.
 */
const deviceCache = new Map<string, string[]>();

async function devicesOf(userId: string): Promise<string[] | "blocked"> {
  const cached = deviceCache.get(userId);
  if (cached) return cached;
  const res = await fetchE2eUserDevices(userId);
  if (!res.ok) {
    if (res.status === 403) return "blocked";
    throw new Error(res.message);
  }
  deviceCache.set(userId, res.data);
  return res.data;
}

interface MismatchDetails {
  missing: { userId: string; deviceId: string }[];
  stale: string[];
}

function applyMismatch(details: unknown): boolean {
  const d = details as Partial<MismatchDetails> | undefined;
  if (!d || !Array.isArray(d.missing) || !Array.isArray(d.stale)) return false;
  const stale = new Set(d.stale);
  for (const [userId, ids] of deviceCache)
    deviceCache.set(
      userId,
      ids.filter((id) => !stale.has(id)),
    );
  for (const { userId, deviceId } of d.missing) {
    const ids = deviceCache.get(userId) ?? [];
    if (!ids.includes(deviceId)) deviceCache.set(userId, [...ids, deviceId]);
  }
  return true;
}

function dropDevice(userId: string, deviceId: string) {
  const ids = deviceCache.get(userId);
  if (ids)
    deviceCache.set(
      userId,
      ids.filter((id) => id !== deviceId),
    );
}

/** Retries after a device-list mismatch before giving up. */
const MAX_V2_ATTEMPTS = 3;

/**
 * Runs under ONE lock for all v2 session state (V2_LOCK), not a
 * per-conversation one: the sender's sessions with their OWN other devices
 * are shared by every conversation, so two tabs sending in two different
 * threads would otherwise race on them. A single lock can't deadlock and the
 * critical section is a few ms of crypto plus the send round trip.
 */
function sendV2(
  engine: RatchetEngine,
  myDeviceId: string,
  opts: E2eSendOptions,
): Promise<E2eSendOutcome> {
  const store = createIndexedDbStore();

  return withConversationLock(V2_LOCK, async (): Promise<E2eSendOutcome> => {
    for (let attempt = 0; attempt < MAX_V2_ATTEMPTS; attempt++) {
      const [peerDevices, myDevices] = await Promise.all([
        devicesOf(opts.recipientId),
        devicesOf(opts.senderId),
      ]);
      if (peerDevices === "blocked" || myDevices === "blocked")
        return {
          ok: false,
          reason: "send-failed",
          message: "Messaging unavailable",
          status: 403,
        };
      if (peerDevices.length === 0)
        return { ok: false, reason: "no-recipient-keys" };

      const targets = [
        ...peerDevices.map((deviceId) => ({
          userId: opts.recipientId,
          deviceId,
        })),
        ...myDevices
          .filter((id) => id !== myDeviceId)
          .map((deviceId) => ({ userId: opts.senderId, deviceId })),
      ];

      const { body, contentKey } = sealBody(opts.plaintext, myDeviceId);
      const envelopes: E2eEnvelope[] = [];
      const advanced: { peerKey: string; session: RatchetSession }[] = [];
      let retry = false;

      for (const target of targets) {
        const key = peerKey(target.userId, target.deviceId);
        const session = await store.getDeviceSession(key);
        let bundle;
        if (!session) {
          const res = await fetchE2eDeviceBundle(target.deviceId);
          if (!res.ok) {
            // Device went inactive since we cached the list — drop, rebuild.
            if (res.status === 404) {
              dropDevice(target.userId, target.deviceId);
              retry = true;
              break;
            }
            return {
              ok: false,
              reason: "send-failed",
              message: res.message,
              status: res.status,
            };
          }
          bundle = res.data;
        }
        // encryptBytes is pure over `session` — a rejected attempt leaves the
        // stored session untouched, so re-encrypting from it is safe.
        const wrapped = await engine.encryptBytes(session, contentKey, bundle);
        envelopes.push({
          recipientDeviceId: target.deviceId,
          header: wrapped.header,
          wrappedKey: wrapped.ciphertext,
        });
        advanced.push({ peerKey: key, session: wrapped.session });
      }
      if (retry) continue;

      const sendRes = await opts.send({
        recipientId: opts.recipientId,
        body,
        e2e: { v: 2, senderDeviceId: myDeviceId, envelopes },
        listingId: opts.listingId,
        clientMessageId: opts.clientMessageId,
      });

      if (!sendRes.ok) {
        if (
          sendRes.code === "E2E_DEVICES_MISMATCH" &&
          applyMismatch(sendRes.details)
        )
          continue;
        if (sendRes.code === "E2E_NO_RECIPIENT_DEVICES") {
          deviceCache.delete(opts.recipientId);
          return { ok: false, reason: "no-recipient-keys" };
        }
        if (sendRes.code === "E2E_DEVICE_INACTIVE") {
          // This browser was evicted; the next bootstrap re-registers it.
          deviceCache.delete(opts.senderId);
          resetE2eEngine();
        }
        return {
          ok: false,
          reason: "send-failed",
          message: sendRes.message,
          status: sendRes.status,
        };
      }

      // Every advanced session + our own plaintext, in one transaction.
      await store.commitDevice(
        advanced,
        sendRes.data.message.id,
        opts.plaintext,
      );
      return { ok: true, result: sendRes.data };
    }

    return {
      ok: false,
      reason: "send-failed",
      message: "Devices keep changing — try again",
      status: 409,
    };
  });
}
