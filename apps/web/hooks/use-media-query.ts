import { useSyncExternalStore } from "react";

/**
 * Live `matchMedia` result. The server snapshot is `false`, so the first
 * client render agrees with the server and the real value lands right after
 * hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
