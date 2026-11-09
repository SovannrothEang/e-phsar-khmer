import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Device-local search history. Deliberately not synced to the account: the
 * captain chose a per-device list, and a search term is transient UI state,
 * not a profile fact. Storage failures are swallowed — history is a
 * convenience and must never block the search screen.
 */
const STORAGE_KEY = "phsarkhmer.search.recent.v1";
export const MAX_RECENT_SEARCHES = 10;

/**
 * Newest-first list with case-insensitive de-duplication. Pure so the
 * dedupe/cap/order rules can be checked without the AsyncStorage mock.
 */
export function mergeRecentSearches(
  current: string[],
  term: string,
  max = MAX_RECENT_SEARCHES,
): string[] {
  const trimmed = term.trim();
  if (!trimmed) return current;
  const key = trimmed.toLowerCase();
  return [
    trimmed,
    ...current.filter((item) => item.trim().toLowerCase() !== key),
  ].slice(0, max);
}

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is string => typeof item === "string" && !!item.trim(),
      )
      .map((item) => item.trim())
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    // A corrupt or unavailable store means "no history", not a crash.
    return [];
  }
}

async function persist(list: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES)),
    );
  } catch {
    // Best effort: the list still renders for this session.
  }
}

/** Adds a submitted term and returns the new list. */
export async function addRecentSearch(term: string): Promise<string[]> {
  const next = mergeRecentSearches(await loadRecentSearches(), term);
  await persist(next);
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best effort: the in-memory list is cleared by the caller either way.
  }
}
