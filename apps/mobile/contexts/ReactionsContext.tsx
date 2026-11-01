import { useAuth } from "@/contexts/AuthContext";
import { ApiError, apiFetch } from "@/lib/api/client";
import { router } from "expo-router";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

interface SaveResponse {
  saved: boolean;
}

interface ReactionsContextType {
  isLiked: (listingId: string) => boolean;
  isSaved: (listingId: string) => boolean;
  likeCountFor: (listingId: string, fallback: number) => number;
  toggleLike: (listingId: string) => Promise<void>;
  toggleSave: (listingId: string) => Promise<void>;
}

const ReactionsContext = createContext<ReactionsContextType | undefined>(
  undefined,
);

function toggleInSet(source: Set<string>, id: string): Set<string> {
  const next = new Set(source);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * One viewer-relative source of truth for every like/save control: hydrated
 * from `GET /users/me/reactions` once per session, toggled optimistically and
 * rolled back when the API refuses.
 */
export const ReactionsProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setLiked(new Set());
      setSaved(new Set());
      setLikeCounts({});
      return;
    }

    (async () => {
      try {
        const { data } = await apiFetch<{ liked: string[]; saved: string[] }>(
          "/users/me/reactions",
        );
        if (cancelled) return;
        setLiked(new Set(data.liked ?? []));
        setSaved(new Set(data.saved ?? []));
      } catch {
        /* anonymous state is the safe default */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const toggleLike = useCallback(
    async (listingId: string) => {
      if (!isAuthenticated) {
        router.push("/(auth)/sign-in");
        return;
      }

      const wasLiked = liked.has(listingId);
      const previous = liked;
      setLiked(toggleInSet(previous, listingId));

      try {
        const { data } = await apiFetch<LikeResponse>(
          `/listings/${listingId}/like`,
          { method: wasLiked ? "DELETE" : "POST" },
        );
        setLiked((current) => {
          const next = new Set(current);
          if (data.liked) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
        setLikeCounts((current) => ({
          ...current,
          [listingId]: data.likeCount,
        }));
      } catch (error) {
        setLiked(previous);
        if (error instanceof ApiError && error.status === 401) {
          router.push("/(auth)/sign-in");
        }
      }
    },
    [isAuthenticated, liked],
  );

  const toggleSave = useCallback(
    async (listingId: string) => {
      if (!isAuthenticated) {
        router.push("/(auth)/sign-in");
        return;
      }

      const wasSaved = saved.has(listingId);
      const previous = saved;
      setSaved(toggleInSet(previous, listingId));

      try {
        const { data } = await apiFetch<SaveResponse>(
          `/listings/${listingId}/save`,
          { method: wasSaved ? "DELETE" : "POST" },
        );
        setSaved((current) => {
          const next = new Set(current);
          if (data.saved) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
      } catch {
        setSaved(previous);
      }
    },
    [isAuthenticated, saved],
  );

  const value = useMemo(
    () => ({
      isLiked: (listingId: string) => liked.has(listingId),
      isSaved: (listingId: string) => saved.has(listingId),
      likeCountFor: (listingId: string, fallback: number) =>
        likeCounts[listingId] ?? fallback,
      toggleLike,
      toggleSave,
    }),
    [liked, saved, likeCounts, toggleLike, toggleSave],
  );

  return (
    <ReactionsContext.Provider value={value}>
      {children}
    </ReactionsContext.Provider>
  );
};

export const useReactions = () => {
  const context = useContext(ReactionsContext);
  if (!context) {
    throw new Error("useReactions must be used within a ReactionsProvider");
  }
  return context;
};
