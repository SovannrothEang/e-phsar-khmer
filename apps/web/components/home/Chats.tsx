"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ChatWorkspace } from "@/components/chat/chat-workspace";

/**
 * Customer ↔ seller messaging surface, mounted by
 * `app/[locale]/(user)/chats/page.tsx`.
 *
 * This used to be a mock-data mockup; the real implementation lives in
 * `components/chat/*`. Kept as the entry point so existing imports (and the
 * route) keep working.
 *
 * The Suspense boundary is required: `ChatWorkspace` reads `useSearchParams()`
 * for the `?to=` / `?listing=` deep links used by "Message seller".
 */
export default function Chats() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-8rem)] min-h-[480px] items-center justify-center border border-border bg-background md:rounded-lg">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
