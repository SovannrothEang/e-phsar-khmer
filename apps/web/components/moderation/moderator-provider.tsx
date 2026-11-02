"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface ModeratorContextValue {
  /**
   * `true` only while an admin dashboard session is active in this browser.
   * Purely a UI flag: every moderation action is authorized by the backend's
   * admin token, so flipping this in devtools cannot perform anything.
   */
  isModerator: boolean;
  /** Listing ids the admin just hid on this page load (optimistic removal). */
  hiddenIds: ReadonlySet<string>;
  /** Drop a card from every list on this page without waiting for a refetch. */
  hideListing: (id: string) => void;
}

const ModeratorContext = createContext<ModeratorContextValue>({
  isModerator: false,
  hiddenIds: new Set(),
  hideListing: () => {},
});

export function ModeratorProvider({
  isModerator,
  children,
}: {
  isModerator: boolean;
  children: React.ReactNode;
}) {
  // The admin expects the card to disappear the moment the action succeeds.
  // A server refresh alone is asynchronous (and the profile feed keeps its
  // props in client state), so the id is removed locally first — the refresh
  // then makes it a no-op. The set lives in the layout provider, so it
  // survives client-side navigation within this tab.
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const hideListing = useCallback((id: string) => {
    setHiddenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ isModerator, hiddenIds, hideListing }),
    [isModerator, hiddenIds, hideListing],
  );
  return (
    <ModeratorContext.Provider value={value}>
      {children}
    </ModeratorContext.Provider>
  );
}

export function useModerator(): ModeratorContextValue {
  return useContext(ModeratorContext);
}

/** `true` once the admin has moderated this listing in the current tab. */
export function useHiddenListing(postId: string | number): boolean {
  return useModerator().hiddenIds.has(String(postId));
}
