"use server";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY: every action in this file MUST use `userServerFetch`, never
 * `serverFetch`.
 *
 * `serverFetch` (lib/api/client.ts) authenticates with the `admin_access_token`
 * cookie — it belongs to the `/wanderer/*` admin dashboard. If a chat action
 * used it, every customer's chat request would run as the ADMIN account and
 * customers would read each other's private conversations. `userServerFetch`
 * reads the separate `user_access_token` cookie, so each request is scoped to
 * the visitor who made it.
 *
 * Do not "fix" an auth error here by swapping in `serverFetch`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError, userServerFetch } from "@/lib/api/user-client";
import type {
  ChatActionResult,
  ChatMessage,
  ChatMessagesMeta,
  ChatPaginationMeta,
  ChatUserSummary,
  ConversationWithUser,
  InboxItem,
  InboxPage,
  MessagePage,
  SendMessageInput,
  SendMessageResult,
} from "@/types/chat";

/** Normalize any thrown error into the serializable failure branch. */
function toFailure(err: unknown): ChatActionResult<never> {
  if (err instanceof ApiError) {
    return {
      ok: false,
      status: err.status,
      code: err.code,
      message: err.message,
    };
  }
  return {
    ok: false,
    status: 0,
    code: "NETWORK_ERROR",
    message: "Network error",
  };
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

// ── Identity ────────────────────────────────────────────────────────────────

/**
 * The signed-in customer, as chat needs them: we compare `message.senderId`
 * against `id` to decide which side of the thread a bubble sits on.
 */
export async function getChatViewer(): Promise<
  ChatActionResult<ChatUserSummary>
> {
  try {
    const { data } = await userServerFetch<ChatUserSummary>("/users/me");
    return {
      ok: true,
      data: {
        id: data.id,
        username: data.username ?? null,
        profilePhotoUrl: data.profilePhotoUrl ?? null,
      },
    };
  } catch (err) {
    return toFailure(err);
  }
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** Inbox page. Cursor is on `(lastMessageAt, id)`; pass `meta.nextCursor` back. */
export async function fetchInbox(
  cursor?: string,
  limit = 20,
): Promise<ChatActionResult<InboxPage>> {
  try {
    const { data, meta } = await userServerFetch<
      InboxItem[],
      ChatPaginationMeta
    >(`/chats${qs({ cursor, limit })}`);
    return {
      ok: true,
      data: {
        items: data,
        meta: meta ?? { nextCursor: null, hasMore: false, limit },
      },
    };
  } catch (err) {
    return toFailure(err);
  }
}

/** Total unread across all threads — the nav badge. */
export async function fetchUnreadCount(): Promise<ChatActionResult<number>> {
  try {
    const { data } = await userServerFetch<{ total: number }>(
      "/chats/unread-count",
    );
    return { ok: true, data: data.total };
  } catch (err) {
    return toFailure(err);
  }
}

/**
 * Resolve the thread with a specific user WITHOUT creating one. `conversation`
 * comes back null when they have never spoken — the thread only materializes
 * on the first `sendChatMessage`.
 */
export async function fetchConversationWith(
  userId: string,
): Promise<ChatActionResult<ConversationWithUser>> {
  try {
    const { data } = await userServerFetch<ConversationWithUser>(
      `/chats/with/${userId}`,
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/**
 * Find-or-create the conversation with `userId` — unlike `fetchConversationWith`
 * this ALWAYS results in a persisted conversation row, even if no message is
 * ever sent. Backs "Message seller": the redirect to `/chats` must land on a
 * thread that already exists (and shows up in the seller's inbox), not one
 * that only materializes once the buyer types something and hits send.
 */
export async function startConversationWith(
  userId: string,
): Promise<ChatActionResult<ConversationWithUser>> {
  try {
    const { data } = await userServerFetch<ConversationWithUser>(
      `/chats/with/${userId}`,
      { method: "POST" },
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/**
 * Delete a conversation from MY inbox only — the other participant's copy
 * (and the message history) is untouched. Reappears automatically the next
 * time either side sends a message or re-opens it via `startConversationWith`.
 */
export async function deleteConversation(
  conversationId: string,
): Promise<ChatActionResult<{ deleted: boolean }>> {
  try {
    const { data } = await userServerFetch<{ deleted: boolean }>(
      `/chats/${conversationId}`,
      { method: "DELETE" },
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/**
 * Message page. Two mutually exclusive modes:
 *  - `cursor` → history, strictly older, newest-first (scrolling up)
 *  - `after`  → poll delta, strictly newer, oldest-first (live tail)
 *
 * A 404 here means "you are not a participant" — the backend deliberately does
 * not distinguish that from "no such conversation" (no existence oracle), so
 * the UI must say *not found*, never *access denied*.
 */
export async function fetchMessages(
  conversationId: string,
  opts: { cursor?: string; after?: string; limit?: number } = {},
): Promise<ChatActionResult<MessagePage>> {
  try {
    const { data, meta } = await userServerFetch<
      ChatMessage[],
      ChatMessagesMeta
    >(
      `/chats/${conversationId}/messages${qs({
        cursor: opts.cursor,
        after: opts.after,
        limit: opts.limit ?? 30,
      })}`,
    );
    return {
      ok: true,
      data: {
        items: data,
        meta: meta ?? {
          nextCursor: null,
          hasMore: false,
          limit: opts.limit ?? 30,
          latestCursor: null,
          peerLastReadAt: null,
        },
      },
    };
  } catch (err) {
    return toFailure(err);
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * Send a message; creates the conversation on the first one. Rejections worth
 * surfacing verbatim: 403 `Messaging unavailable` (a block exists in either
 * direction) and 400 (self-message / empty / bad image path / listing owned by
 * neither participant).
 */
export async function sendChatMessage(
  input: SendMessageInput,
): Promise<ChatActionResult<SendMessageResult>> {
  try {
    const { data } = await userServerFetch<SendMessageResult>(
      "/chats/messages",
      { method: "POST", body: JSON.stringify(input) },
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/** Bulk mark-read. Debounced by the caller — never fire this per render. */
export async function markConversationRead(
  conversationId: string,
): Promise<ChatActionResult<{ marked: number }>> {
  try {
    const { data } = await userServerFetch<{ marked: number }>(
      `/chats/${conversationId}/read`,
      { method: "POST" },
    );
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

// ── Uploads ─────────────────────────────────────────────────────────────────

interface SignUploadResponse {
  signedUrl: string;
  path: string;
  token: string;
  publicUrl: string;
}

/**
 * Signed upload URL for a chat image, scoped to the CURRENT USER.
 *
 * Deliberately not reusing `actions/files.ts#signUpload`: that one runs through
 * `serverFetch`, so the backend would mint a path under the admin's id
 * (`chat/{adminId}/…`) and then reject the send, since it requires `imagePath`
 * to sit under the sender's own prefix.
 */
export async function signChatUpload(
  filename: string,
): Promise<ChatActionResult<SignUploadResponse>> {
  try {
    const { data } = await userServerFetch<SignUploadResponse>("/files/sign", {
      method: "POST",
      body: JSON.stringify({ filename, scope: "chat" }),
    });
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

/** Clean up an orphaned chat upload (picked an image, then cancelled). */
export async function deleteChatUpload(
  path: string,
): Promise<ChatActionResult<null>> {
  try {
    await userServerFetch("/files", {
      method: "DELETE",
      body: JSON.stringify({ paths: [path] }),
    });
    return { ok: true, data: null };
  } catch (err) {
    return toFailure(err);
  }
}
