import type { ChatActionResult } from "@/types/chat";

/**
 * Query keys for the customer chat surface. The admin dashboard namespaces its
 * keys under `["admin", …]`; the user surface uses `["user", …]` so the two
 * caches can never collide inside a single QueryClient.
 */
export const chatKeys = {
  all: ["user", "chat"] as const,
  viewer: () => [...chatKeys.all, "viewer"] as const,
  inbox: () => [...chatKeys.all, "inbox"] as const,
  unread: () => [...chatKeys.all, "unread"] as const,
  thread: (conversationId: string) =>
    [...chatKeys.all, "thread", conversationId] as const,
  with: (userId: string) => [...chatKeys.all, "with", userId] as const,
};

/** Error carrying the backend HTTP status, so components can branch on it. */
export class ChatRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

/**
 * Turn a server action's {@link ChatActionResult} into a value-or-throw, which
 * is what TanStack Query's `queryFn` contract expects.
 */
export function unwrap<T>(result: ChatActionResult<T>): T {
  if (result.ok) return result.data;
  throw new ChatRequestError(result.status, result.code, result.message);
}

/** Status helpers — the three error shapes the chat UI has to render. */
export function isNotFound(err: unknown): boolean {
  return err instanceof ChatRequestError && err.status === 404;
}

export function isBlocked(err: unknown): boolean {
  return err instanceof ChatRequestError && err.status === 403;
}

export function isUnauthenticated(err: unknown): boolean {
  return err instanceof ChatRequestError && err.status === 401;
}
