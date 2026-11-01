import { ApiError } from "@/lib/api/client";
import { sendChatMessage } from "@/lib/api/chat";
import { fetchE2eDeviceBundle, fetchE2eUserDevices } from "@/lib/api/e2e";
import { sealBody } from "./content";
import { withE2eLock } from "./lock";
import { getDeviceSession, saveDecrypted, saveDeviceSessions } from "./store";
import type { E2eEnvelope, RatchetEngine, RatchetSession } from "./types";

export type SendOutcome =
  | {
      ok: true;
      conversationId: string;
      messageId: string;
      plaintext: string;
    }
  | {
      ok: false;
      reason:
        | "engine-unavailable"
        | "no-recipient-devices"
        | "blocked"
        | "device-churn"
        | "failed";
      message: string;
      status?: number;
    };

/** Device lists per user, cached for the app process; patched by 409s. */
const deviceCache = new Map<string, string[]>();
const MAX_ATTEMPTS = 3;

async function devicesOf(userId: string): Promise<string[] | "blocked"> {
  const cached = deviceCache.get(userId);
  if (cached) return cached;
  try {
    const devices = await fetchE2eUserDevices(userId);
    deviceCache.set(userId, devices);
    return devices;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return "blocked";
    throw error;
  }
}

interface MismatchDetails {
  missing: { userId: string; deviceId: string }[];
  stale: string[];
}

function applyMismatch(details: unknown): boolean {
  const parsed = details as Partial<MismatchDetails> | undefined;
  if (!parsed || !Array.isArray(parsed.missing) || !Array.isArray(parsed.stale))
    return false;

  const stale = new Set(parsed.stale);
  for (const [userId, ids] of deviceCache) {
    deviceCache.set(
      userId,
      ids.filter((id) => !stale.has(id)),
    );
  }
  for (const { userId, deviceId } of parsed.missing) {
    const ids = deviceCache.get(userId) ?? [];
    if (!ids.includes(deviceId)) deviceCache.set(userId, [...ids, deviceId]);
  }
  return true;
}

function dropDevice(userId: string, deviceId: string): void {
  const ids = deviceCache.get(userId);
  if (ids) {
    deviceCache.set(
      userId,
      ids.filter((id) => id !== deviceId),
    );
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Encryption failed";
}

/**
 * v2 send, ported from the web's `sendV2`: seal the body once under a random
 * content key, wrap that key for every recipient device and every OTHER
 * device of mine, and let the backend's device-set check be the authority.
 */
export function sendEncryptedText(
  engine: RatchetEngine,
  input: {
    recipientId: string;
    plaintext: string;
    clientMessageId: string;
    listingId?: string;
  },
): Promise<SendOutcome> {
  const senderId = engine.userId;
  const senderDeviceId = engine.deviceId;

  if (!senderId || !senderDeviceId) {
    return Promise.resolve({
      ok: false,
      reason: "engine-unavailable",
      message: "Chat encryption is not ready yet.",
    });
  }

  return withE2eLock(async (): Promise<SendOutcome> => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const [peerDevices, myDevices] = await Promise.all([
        devicesOf(input.recipientId),
        devicesOf(senderId),
      ]);

      if (peerDevices === "blocked" || myDevices === "blocked") {
        return {
          ok: false,
          reason: "blocked",
          message: "Messaging unavailable",
          status: 403,
        };
      }
      if (peerDevices.length === 0) {
        return {
          ok: false,
          reason: "no-recipient-devices",
          message: "This user cannot receive encrypted messages yet.",
        };
      }

      const targets = [
        ...peerDevices.map((deviceId) => ({
          userId: input.recipientId,
          deviceId,
        })),
        ...myDevices
          .filter((deviceId) => deviceId !== senderDeviceId)
          .map((deviceId) => ({ userId: senderId, deviceId })),
      ];

      const sealed = sealBody(input.plaintext, senderDeviceId);
      const envelopes: E2eEnvelope[] = [];
      const advanced: {
        peerUserId: string;
        peerDeviceId: string;
        session: RatchetSession;
      }[] = [];
      let retry = false;

      for (const target of targets) {
        const session = await getDeviceSession(
          senderId,
          target.userId,
          target.deviceId,
        );
        let bundle;
        if (!session) {
          try {
            bundle = await fetchE2eDeviceBundle(target.deviceId);
          } catch (error) {
            // The device went inactive since we cached the list — rebuild.
            if (error instanceof ApiError && error.status === 404) {
              dropDevice(target.userId, target.deviceId);
              retry = true;
              break;
            }
            return {
              ok: false,
              reason: "failed",
              message: errorMessage(error),
              status: error instanceof ApiError ? error.status : undefined,
            };
          }
        }

        // Pure over `session`: a rejected attempt leaves the stored session
        // untouched, so re-encrypting from it is safe.
        const wrapped = await engine.encryptBytes(
          session,
          sealed.contentKey,
          bundle,
        );
        envelopes.push({
          recipientDeviceId: target.deviceId,
          header: wrapped.header,
          wrappedKey: wrapped.ciphertext,
        });
        advanced.push({
          peerUserId: target.userId,
          peerDeviceId: target.deviceId,
          session: wrapped.session,
        });
      }

      if (retry) continue;

      try {
        const result = await sendChatMessage({
          recipientId: input.recipientId,
          body: sealed.body,
          e2e: { v: 2, senderDeviceId, envelopes },
          clientMessageId: input.clientMessageId,
          ...(input.listingId ? { listingId: input.listingId } : {}),
        });
        await saveDeviceSessions(senderId, advanced);
        // My own device gets no envelope for its own message — keep the
        // plaintext so history on this device renders.
        await saveDecrypted(result.message.id, input.plaintext);
        return {
          ok: true,
          conversationId: result.conversationId,
          messageId: result.message.id,
          plaintext: input.plaintext,
        };
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === "E2E_DEVICES_MISMATCH" &&
          applyMismatch(error.details)
        ) {
          continue;
        }
        return {
          ok: false,
          reason: "failed",
          message: errorMessage(error),
          status: error instanceof ApiError ? error.status : undefined,
        };
      }
    }

    return {
      ok: false,
      reason: "device-churn",
      message: "The device list kept changing. Please try again.",
    };
  });
}
