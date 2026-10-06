"use client";

import * as React from "react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "@/i18n/routing";
import {
  likeListing,
  saveListing,
  unlikeListing,
  unsaveListing,
} from "@/actions/reactions";

/**
 * The signed-in viewer's likes and saves, shared by every card and control on
 * the page.
 *
 * Seeded server-side from one batched call (`GET /users/me/reactions`) in the
 * user layout, so a card's first paint is already truthful — no per-card
 * fetch, no flash of "not liked". Toggles flip optimistically (the control IS
 * the interaction; waiting a round trip to move it reads as broken) and roll
 * back with a toast if the call fails. A visitor gets the sign-in bounce
 * instead — the same contract FollowButton documents.
 */
interface ReactionsValue {
  signedIn: boolean;
  isLiked: (listingId: string) => boolean;
  isSaved: (listingId: string) => boolean;
  /** A like or save for this listing is in flight; the control disables. */
  isPending: (listingId: string) => boolean;
  /** Toggled off this session — the `/me` lists drop the row live. */
  isToggledOff: (kind: "like" | "save", listingId: string) => boolean;
  /** The count the detail control shows: toggle responses win over the seed. */
  likeCount: (listingId: string, fallback: number) => number;
  toggleLike: (listingId: string) => void;
  toggleSave: (listingId: string) => void;
}

const ReactionsContext = React.createContext<ReactionsValue | null>(null);

/**
 * Real listings carry UUID ids; the mock cards (home Top Ads, the non-UUID
 * detail slugs) carry numeric ones and have no row to react to. The controls
 * render on both, so a mock id is simply inert — before this guard, clicking
 * a demo heart fired a real request and surfaced a validation error on the
 * most-visited page.
 */
const LISTING_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withMembership(
  set: Set<string>,
  id: string,
  member: boolean,
): Set<string> {
  const next = new Set(set);
  if (member) next.add(id);
  else next.delete(id);
  return next;
}

export function ReactionsProvider({
  signedIn,
  initialLiked,
  initialSaved,
  children,
}: {
  signedIn: boolean;
  initialLiked: string[];
  initialSaved: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [liked, setLiked] = React.useState(() => new Set(initialLiked));
  const [saved, setSaved] = React.useState(() => new Set(initialSaved));
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  // Keyed `${kind}:${listingId}` so a like and a save on the same card can be
  // in flight together without one clearing the other's pending state.
  const [pending, setPending] = React.useState<Set<string>>(new Set());
  // Edges this session toggled OFF. The `/me` lists were fetched before the
  // toggle, so they filter against this instead of against membership — the
  // seed sets are fail-soft (empty on a failed fetch), and filtering by
  // membership would blank the whole list in that case.
  const [toggledOff, setToggledOff] = React.useState<Set<string>>(new Set());

  const setPendingFor = (key: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleLike = (listingId: string) => {
    if (!LISTING_UUID.test(listingId)) return;
    if (!signedIn) {
      toast.error("Sign in to like");
      router.push("/login");
      return;
    }
    const key = `like:${listingId}`;
    if (pending.has(key)) return;

    const next = !liked.has(listingId);
    setLiked((prev) => withMembership(prev, listingId, next));
    setToggledOff((prev) => withMembership(prev, key, !next));
    setPendingFor(key, true);

    void (async () => {
      const res = next
        ? await likeListing(listingId)
        : await unlikeListing(listingId);
      setPendingFor(key, false);

      if (!res.success) {
        // Roll back — the optimistic flip was a lie if the call failed.
        setLiked((prev) => withMembership(prev, listingId, !next));
        setToggledOff((prev) => withMembership(prev, key, next));
        toast.error(res.error ?? "Something went wrong");
        return;
      }
      if (typeof res.likeCount === "number") {
        const likeCount = res.likeCount;
        setCounts((prev) => ({ ...prev, [listingId]: likeCount }));
      }
    })();
  };

  const toggleSave = (listingId: string) => {
    if (!LISTING_UUID.test(listingId)) return;
    if (!signedIn) {
      toast.error("Sign in to save");
      router.push("/login");
      return;
    }
    const key = `save:${listingId}`;
    if (pending.has(key)) return;

    const next = !saved.has(listingId);
    setSaved((prev) => withMembership(prev, listingId, next));
    setToggledOff((prev) => withMembership(prev, key, !next));
    setPendingFor(key, true);

    void (async () => {
      const res = next
        ? await saveListing(listingId)
        : await unsaveListing(listingId);
      setPendingFor(key, false);

      if (!res.success) {
        setSaved((prev) => withMembership(prev, listingId, !next));
        setToggledOff((prev) => withMembership(prev, key, next));
        toast.error(res.error ?? "Something went wrong");
      }
    })();
  };

  const value: ReactionsValue = {
    signedIn,
    isLiked: (id) => liked.has(id),
    isSaved: (id) => saved.has(id),
    isPending: (id) => pending.has(`like:${id}`) || pending.has(`save:${id}`),
    isToggledOff: (kind, id) => toggledOff.has(`${kind}:${id}`),
    likeCount: (id, fallback) => counts[id] ?? fallback,
    toggleLike,
    toggleSave,
  };

  return (
    <ReactionsContext.Provider value={value}>
      {children}
    </ReactionsContext.Provider>
  );
}

export function useReactions(): ReactionsValue {
  const ctx = React.useContext(ReactionsContext);
  if (!ctx) {
    throw new Error("useReactions must be used inside a ReactionsProvider");
  }
  return ctx;
}
