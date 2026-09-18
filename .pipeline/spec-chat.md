# Spec: Chat history pagination, virtualized rendering, and loading UX

## Decisions taken (confirmed with the user)

1. **Full virtualization** of the message thread with `@tanstack/react-virtual` (not a bounded window).
2. **RSC prefetch + `HydrationBoundary`** for the `/chats` first paint.
3. **All phases in one pass** (0-4).

## OPEN QUESTIONS

None blocking. Two judgment calls made in-spec, flagged for objection during review:

- Initial thread page = **40** messages (fills a tall desktop viewport in one round trip); "older" pages stay **30**; inbox stays **20**. All within the backend's `Max(100)` clamp.
- **No `maxPages` cap** on the thread infinite query - see Design / Phase 1.4 for why.

## Current state (verified, not assumed)

Pagination already exists on both sides. The premise "the web reads the whole history" is **not** what the code does:

- `chat.service.ts:270` `getMessages` is keyset-paginated in both directions (`cursor=` history DESC, `after=` delta ASC), `limit` defaults to 30 and is clamped to **max 100** by `QueryMessagesDto`. Index `messages_conversation_created_idx (conversation_id, created_at, id)` serves both scans.
- `getInbox` (`chat.service.ts:176`) is keyset on `(last_message_at, id)`; `buildInboxItems` batches last-message / unread-count / user-summary lookups - no N+1.
- `use-chat-thread.ts:30` already uses `useInfiniteQuery` with `PAGE_SIZE = 30` plus a "Load older" button.

**No backend change is required for pagination.** What degrades with volume is what the client _keeps mounted_ and _recomputes_, not what it fetches.

## Problems this change fixes

| #   | Problem                                                                                                                                                                                                                                                                                                                    | Evidence                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P1  | Every message ever loaded stays in the DOM. 10 "Load older" clicks = 300 mounted bubbles + avatars + images, forever.                                                                                                                                                                                                      | `message-thread.tsx` renders all of `grouped`                                             |
| P2  | The **entire** loaded timeline is re-Mapped and re-sorted on every poll tick, then re-bucketed by day - even when the poll returns zero messages, because the delta `queryFn` returns a fresh object every 3s. Cost scales with total history, not with what is new. **Main cause of "it gets slower as chat builds up".** | `use-chat-thread.ts` `mergeMessages(historyItems, delta.data?.messages)` + `grouped` memo |
| P3  | The inbox poll refetches **every loaded page**: `useInfiniteQuery` + `refetchInterval` refetches all pages sequentially, so 5 "Load more" clicks = 5 backend round trips every 20s per open tab.                                                                                                                           | `chat-workspace.tsx:65`                                                                   |
| P4  | Client memory only grows: `deltaStoreRef` accumulates polled messages _in parallel with_ the history pages (double storage), and WS-delivered rows pushed into `local` are never pruned once the server returns them.                                                                                                      | `use-chat-thread.ts` `deltaStoreRef`, `setLocal` in `handleWsMessage`                     |
| P5  | Cold open is a 3-hop client-side waterfall - `/users/me` then `/chats/with/:id` then `/chats/:id/messages` - all after hydration, each through a Next server action. The static shell paints instantly, then spinners.                                                                                                     | `chat-workspace.tsx` viewer -> withPeer -> `use-chat-thread` history                      |
| P6  | Loading/scroll polish: bottom anchoring runs in `useEffect` **after** paint (visible jump from the top of the thread); "Load older" requires a click; no "new messages" affordance when scrolled up; thread-switch shows a bare centered spinner while first load shows a bubble skeleton - two loading languages.         | `message-thread.tsx` scroll effect, `chat-workspace.tsx:192`                              |

## Design

### Phase 0 - Measurement harness (so before/after is measured, not guessed)

- **New** `apps/backend/src/db/seeds/chat-load.seed.ts` - dev-only, **not** wired into `src/db/seed.ts`. Takes two user ids (argv or env), find-or-creates their conversation, inserts N (default 5,000) messages in batches of 500 with timestamps spread backwards, ~15% carrying `imageUrl`/`imagePath`, ~5% carrying a `listingId`. Bumps `conversations.last_message_at`.
- **Modify** `apps/backend/package.json` - add `"db:seed:chat": "ts-node src/db/seeds/chat-load.seed.ts"`.
- Baseline numbers recorded in `.pipeline/test-results.md`: thread DOM node count after 10 pages, JS heap, scripting ms per poll tick, time-to-first-bubble on cold load.

### Phase 1 - Data layer (`hooks/use-chat-thread.ts`, `chat-workspace.tsx`)

1. **Delta results land in the query cache, not a parallel store.** The delta `queryFn` merges new rows into the thread's infinite-query cache via `queryClient.setQueryData` (insert into `pages[0].items`, refresh `pages[0].meta.latestCursor`) and then returns only `{ peerLastReadAt }`. `deltaStoreRef` is deleted. Fixes P4's double storage and removes the per-tick array identity change that drives P2.
2. **Timeline built incrementally.** `messages` is memoized on `history.data` + `local` only. Each page is already sorted and pages are contiguous by cursor, so the global `mergeMessages` re-sort is replaced by: reverse-concat of pages (oldest page last) + binary insertion for cache-merged delta rows. An empty poll now costs zero timeline work.
3. **Prune `local`.** After a server row with the same id appears (HTTP confirm or WS echo), drop the local entry in an effect instead of filtering it out on every render forever.
4. **No `maxPages` on the thread query.** With virtualization the DOM is already constant; a message object is ~300 B, so 10,000 loaded messages is ~3 MB of JS - and reaching that needs ~330 "load older" fetches in one session. Adding `maxPages` would require a bidirectional infinite query (`getPreviousPageParam` + refetch-on-scroll-down), which is real complexity for no measured win. Revisit only if Phase 0 numbers say otherwise.
5. **Inbox poll stops amplifying (P3).** `refetchInterval` is removed from the inbox infinite query. A separate lightweight head query (`chatKeys.inboxHead()`) polls page 1 every `CHAT_POLL.inboxMs` and is merged over the paginated list by id (head rows replace matching rows and re-sort by `lastMessageAt`). Poll cost becomes 1 request per tick regardless of how many pages are loaded. The inbox read moves out of `chat-workspace.tsx` into a **new** `hooks/use-chat-inbox.ts` so the merge logic is testable and the workspace stays presentational.

### Phase 2 - Virtualized thread (`message-thread.tsx`, new `lib/chat/rows.ts`)

- **Dependency:** `pnpm --filter web add @tanstack/react-virtual`.
- **Flat row model** (new `lib/chat/rows.ts`): `toThreadRows(messages)` returns `({ kind: 'day'; key; iso } | { kind: 'message'; key; message })[]`. Day separators become their own virtual rows; nested groups are not virtualizable without measurement bugs. Replaces the `grouped` memo.
- **Virtualizer:** `useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, getItemKey: i => rows[i].key, estimateSize: i => rows[i].kind === 'day' ? 32 : 76, overscan: 8 })` with `measureElement` on each row for dynamic text heights. Inner absolutely-positioned container sized to `getTotalSize()`.
- **Measurement churn is bounded** because chat images are already fixed-size squares (`message-bubble.tsx:71` - `h-44 w-44 sm:h-52 sm:w-52`), so only wrapped text varies. An `onLoad -> virtualizer.measure()` safety net covers late decodes.
- **Bottom anchor without the jump (P6):** first anchor runs in `useLayoutEffect` via `scrollToIndex(rows.length - 1, { align: 'end' })`; the list stays `opacity-0` until that commit, so the first paint is already at the bottom.
- **Prepend anchor kept:** the existing distance-from-bottom capture (`restoreOffsetRef`) is retained and restored in a `useLayoutEffect` when row count grows at the top.
- **Sticky bottom vs. pill:** on growth, if `atBottomRef` then `scrollToIndex(last)`; otherwise increment a counter and show a "New messages (n)" pill that scrolls to bottom on click.
- **Auto-load-older:** on scroll, `scrollTop < 400 && hasOlder && !isLoadingOlder` triggers `loadOlder()`. Scroll-threshold rather than an IntersectionObserver sentinel, which is unreliable against absolutely-positioned virtual rows. Row 0 renders an inline "loading earlier messages" row; the existing button stays as a fallback.

### Phase 3 - First paint and loading states

- **`app/[locale]/(user)/chats/page.tsx` becomes an async server component.** It awaits `searchParams` (Next 16: it is a Promise), and with the user's cookie fetches - via `userServerFetch`, **never** `serverFetch` - `/users/me` and `/chats?limit=20`; when `?to=` is present, also `/chats/with/:id` and, if a conversation exists, `/chats/:id/messages?limit=40`. It seeds a server `QueryClient` with the **exact** client keys (`chatKeys.viewer()`, `chatKeys.inbox()` in infinite shape `{ pages: [page], pageParams: [null] }`, `chatKeys.with(id)`, `chatKeys.thread(cid)`) and wraps the tree in `<HydrationBoundary state={dehydrate(qc)}>`. A 401 prefetches nothing and falls through to the existing client-side unauthenticated branch.
- **`Chats.tsx`** keeps its `Suspense` boundary (`ChatWorkspace` still reads `useSearchParams`) and forwards the dehydrated state.
- **One loading language:** the bare `Loader2` for thread-switch (`chat-workspace.tsx:192`) is replaced by `ThreadSkeleton`; `placeholderData: keepPreviousData` on the `with` query keeps the previous thread visible (dimmed) while the next resolves.
- **Inbox** gets skeleton rows for the next page instead of only a button spinner.
- **New i18n keys** under `Chat` in all six locale files (`en, km, zh, ko, id, vi`): `thread.newMessages`, `thread.loadingOlder`, `inbox.loadingMore`.

### Phase 4 - Verification

`pnpm --filter web build` (the type gate), `pnpm --filter web lint`, `pnpm --filter backend test`, then a manual pass on the 5,000-message thread: cold open, scroll to top through ~10 pages, receive while scrolled up, thread switch, mobile back/forward. Numbers land in `.pipeline/test-results.md` next to the Phase 0 baseline.

## Files

**Backend** - new `src/db/seeds/chat-load.seed.ts`; modified `package.json` (one script). No schema, migration, service, or DTO change.

**Web** - new `hooks/use-chat-inbox.ts`, `lib/chat/rows.ts`; modified `hooks/use-chat-thread.ts`, `components/chat/message-thread.tsx`, `components/chat/chat-workspace.tsx`, `components/chat/conversation-list.tsx`, `components/home/Chats.tsx`, `app/[locale]/(user)/chats/page.tsx`, `lib/chat/queries.ts` (add `inboxHead` key), `messages/*.json` (6 files), `package.json` (+`@tanstack/react-virtual`).

## Non-goals

Backend pagination/API changes; WebSocket protocol changes; push notifications; message deletion or search; virtualizing the inbox list (it is paginated and short); changing the poll tiers in `use-chat-polling.ts`.

## Risks

| Risk                                                          | Mitigation                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Virtualization measurement churn on variable-height bubbles   | `measureElement` + already-fixed image sizes + `onLoad` remeasure                                                       |
| Scroll anchoring regressions on prepend / on new arrivals     | Existing distance-from-bottom anchor kept, moved to `useLayoutEffect`; explicit manual test matrix in Phase 4           |
| RSC prefetch key/shape mismatch causing a silent double fetch | Keys come from `chatKeys`; inbox dehydrated in exact infinite-query shape; verified on the network tab during cold load |
| SSR adds a server hop per `/chats` navigation                 | Prefetch limited to inbox page 1 + the deep-linked thread's first page                                                  |
| Inbox head-merge could reorder or duplicate rows              | Merge by id into a `Map`, re-sort by `lastMessageAt` desc, isolated in `use-chat-inbox.ts`                              |
