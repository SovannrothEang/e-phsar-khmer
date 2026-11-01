import type { ChatMessage } from "@/lib/api/chat";
import { openBody } from "./content";
import { withE2eLock } from "./lock";
import {
  getDecrypted,
  getDeviceSession,
  getRestored,
  saveDecrypted,
  saveDeviceSessions,
} from "./store";
import type { RatchetEngine } from "./types";

export type DecryptOutcome =
  | { status: "ok"; plaintext: string }
  /**
   * Not a crypto error: this device has no envelope/key for the message
   * (it predates the device, or it is v1-encrypted history). Rendered as a
   * neutral note, not an error.
   */
  | { status: "unavailable" }
  | { status: "failed"; reason: string };

/**
 * The account-backup fallback: plaintext restored by another device that had
 * the key. Consulted only when this device cannot decrypt — it is never
 * preferred over a live decrypt.
 */
async function restoredOrUnavailable(
  messageId: string,
): Promise<DecryptOutcome> {
  const restored = await getRestored(messageId);
  return restored !== null
    ? { status: "ok", plaintext: restored }
    : { status: "unavailable" };
}

/** Legacy plaintext rows and cached plaintext need no ratchet work. */
export async function decryptChatMessage(
  engine: RatchetEngine,
  message: ChatMessage,
): Promise<DecryptOutcome> {
  if (!message.isE2e) {
    return message.body
      ? { status: "ok", plaintext: message.body }
      : { status: "unavailable" };
  }

  const cached = await getDecrypted(message.id);
  if (cached !== null) return { status: "ok", plaintext: cached };

  // v1 history has no v2 envelopes; the phone has no v1 identity.
  if (message.e2eVersion !== 2) {
    return restoredOrUnavailable(message.id);
  }

  const myDeviceId = engine.deviceId;
  const senderId = engine.userId;
  if (!myDeviceId || !senderId || !message.body) {
    return restoredOrUnavailable(message.id);
  }

  const envelope = message.envelopes?.find(
    (entry) => entry.recipientDeviceId === myDeviceId,
  );
  if (!envelope) return restoredOrUnavailable(message.id);
  if (!message.senderDeviceId) {
    return restoredOrUnavailable(message.id);
  }

  return withE2eLock(async (): Promise<DecryptOutcome> => {
    try {
      // Re-read under the lock: a previous decrypt may have advanced it.
      const cachedNow = await getDecrypted(message.id);
      if (cachedNow !== null) return { status: "ok", plaintext: cachedNow };

      const session = await getDeviceSession(
        senderId,
        message.senderId,
        message.senderDeviceId as string,
      );
      const keyResult = await engine.decryptBytes(
        session,
        envelope.header,
        envelope.wrappedKey,
      );
      const plaintext = openBody(
        message.body as string,
        keyResult.plaintext,
        message.senderDeviceId as string,
      );

      await saveDeviceSessions(senderId, [
        {
          peerUserId: message.senderId,
          peerDeviceId: message.senderDeviceId as string,
          session: keyResult.session,
        },
      ]);
      await saveDecrypted(message.id, plaintext);
      return { status: "ok", plaintext };
    } catch (error) {
      const restored = await getRestored(message.id);
      if (restored !== null) return { status: "ok", plaintext: restored };
      return {
        status: "failed",
        reason: error instanceof Error ? error.message : "decrypt failed",
      };
    }
  });
}

/** Decrypt a page sequentially — sessions advance, so order matters. */
export async function decryptPage(
  engine: RatchetEngine,
  messages: ChatMessage[],
): Promise<Map<string, DecryptOutcome>> {
  const out = new Map<string, DecryptOutcome>();
  for (const message of messages) {
    out.set(message.id, await decryptChatMessage(engine, message));
  }
  return out;
}
