"use server";

/**
 * Server actions for encrypted chat attachments (`/chats/attachments`).
 * Only ciphertext sizes and ids cross this boundary — the encrypted bytes go
 * straight from the browser to storage via the signed upload URL, and keys
 * never leave the E2E message. Uses `userServerFetch` (see actions/chat.ts).
 */

import { ApiError, userServerFetch } from "@/lib/api/user-client";
import type { ChatActionResult } from "@/types/chat";

export interface AttachmentUploadTicket {
  id: string;
  uploadUrl: string;
  token: string;
  expiresIn: number;
}

export interface AttachmentDownloadUrl {
  id: string;
  url: string;
  expiresAt: string;
}

function toFailure(err: unknown): ChatActionResult<never> {
  if (err instanceof ApiError) {
    return {
      ok: false,
      status: err.status,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }
  return {
    ok: false,
    status: 0,
    code: "NETWORK_ERROR",
    message: "Network error",
  };
}

async function post<T>(
  path: string,
  body?: unknown,
): Promise<ChatActionResult<T>> {
  try {
    const { data } = await userServerFetch<T>(path, {
      method: "POST",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { ok: true, data };
  } catch (err) {
    return toFailure(err);
  }
}

export async function createChatAttachment(input: {
  id: string;
  kind: "image" | "file";
  declaredSize: number;
}) {
  return post<AttachmentUploadTicket>("/chats/attachments", input);
}

export async function completeChatAttachment(id: string) {
  return post<{ id: string; status: "uploaded"; actualSize: number }>(
    `/chats/attachments/${id}/complete`,
  );
}

export async function signChatAttachments(ids: string[]) {
  return post<AttachmentDownloadUrl[]>("/chats/attachments/sign", { ids });
}
