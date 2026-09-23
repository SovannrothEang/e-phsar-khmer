import { fetchE2eKeyBundle } from "@/actions/e2e";
import type { SendMessageInput, SendMessageResult } from "@/types/chat";
import type { ChatActionResult } from "@/types/chat";
import { withConversationLock } from "./lock";
import { createIndexedDbStore } from "./store";
import type { RatchetEngine } from "./types";

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

/**
 * Encrypt one text body and deliver it, with the Double Ratchet session
 * committed only after the server accepts the ciphertext.
 *
 * The whole encrypt → send → commit sequence runs under the per-conversation
 * Web Lock: releasing it after encrypt (and re-acquiring for commit) would
 * let a second tab encrypt from the stale session in between, permanently
 * desyncing the chain.
 *
 * Always uses the HTTP path even when a WebSocket is connected — the session
 * commit needs `conversationId` + `message.id` from the send response, which
 * the fire-and-forget WS envelope does not carry.
 */
export async function sendE2eText(
  engine: RatchetEngine | null,
  opts: {
    conversationId: string | null;
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
  },
): Promise<E2eSendOutcome> {
  if (!engine) return { ok: false, reason: "engine-unavailable" };

  const store = createIndexedDbStore();
  const lockKey = opts.conversationId ?? `new-${opts.recipientId}`;

  try {
    return await withConversationLock(
      lockKey,
      async (): Promise<E2eSendOutcome> => {
        const session = opts.conversationId
          ? await store.getSession(opts.conversationId)
          : null;

        let bundle;
        if (!session) {
          const res = await fetchE2eKeyBundle(opts.recipientId);
          // 404 = peer has never bootstrapped keys — refuse, no plaintext
          // fallback (spec decision #6).
          if (!res.ok) {
            if (res.status === 404)
              return { ok: false, reason: "no-recipient-keys" };
            return {
              ok: false,
              reason: "encrypt-failed",
              message: res.message,
            };
          }
          bundle = res.data;
        }

        let encrypted;
        try {
          encrypted = await engine.encrypt(session, opts.plaintext, bundle);
        } catch (err) {
          return {
            ok: false,
            reason: "encrypt-failed",
            message: err instanceof Error ? err.message : "encrypt failed",
          };
        }

        const sendRes = await opts.send({
          recipientId: opts.recipientId,
          body: encrypted.ciphertext,
          e2eHeader: encrypted.header,
          listingId: opts.listingId,
          clientMessageId: opts.clientMessageId,
        });
        if (!sendRes.ok) {
          return {
            ok: false,
            reason: "send-failed",
            message: sendRes.message,
            status: sendRes.status,
          };
        }

        // Session advanced only now that the ciphertext is durable server-side.
        const conversationId =
          opts.conversationId ?? sendRes.data.conversationId;
        await store.commit(
          conversationId,
          encrypted.session,
          sendRes.data.message.id,
          opts.plaintext,
        );

        return { ok: true, result: sendRes.data };
      },
    );
  } catch (err) {
    return {
      ok: false,
      reason: "encrypt-failed",
      message: err instanceof Error ? err.message : "encrypt failed",
    };
  }
}
