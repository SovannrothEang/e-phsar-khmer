import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";

/** The permission/read states the Nearby card and the New Ad pin render. */
export type CurrentLocationPermission =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "blocked"
  | "error";

export interface CurrentLocationFix {
  lat: number;
  lng: number;
}

export interface CurrentLocationResult {
  permission: CurrentLocationPermission;
  fix: CurrentLocationFix | null;
}

const FIX_TTL_MS = 5 * 60_000;
const LAST_KNOWN_TIMEOUT_MS = 3_000;
const CURRENT_FIX_TIMEOUT_MS = 8_000;

/**
 * One in-memory fix shared by every caller. Deliberately never persisted:
 * the device position must not outlive the session or reach AsyncStorage,
 * SecureStore or analytics.
 */
let cachedFix: { fix: CurrentLocationFix; at: number } | null = null;

function freshCachedFix(): CurrentLocationFix | null {
  if (!cachedFix) return null;
  return Date.now() - cachedFix.at < FIX_TTL_MS ? cachedFix.fix : null;
}

/** A hung provider must not leave the card spinning forever. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("location request timed out")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Foreground location with an explicit request.
 *
 * Reading the permission on mount never prompts; only `request()` shows the
 * OS dialog. A grant made in Settings while the app was backgrounded is
 * picked up on the next foreground.
 */
export function useCurrentLocation() {
  const [permission, setPermission] =
    useState<CurrentLocationPermission>("idle");
  const [coords, setCoords] = useState<CurrentLocationFix | null>(
    freshCachedFix,
  );
  const [error, setError] = useState<string | null>(null);
  const requesting = useRef(false);

  const applyStatus = useCallback(
    (status: Location.PermissionStatus, canAskAgain: boolean) => {
      if (status === "granted") setPermission("granted");
      else if (status === "undetermined") setPermission("idle");
      else if (canAskAgain) setPermission("denied");
      else setPermission("blocked");
    },
    [],
  );

  const readPosition =
    useCallback(async (): Promise<CurrentLocationFix | null> => {
      const cached = freshCachedFix();
      if (cached) {
        setCoords(cached);
        return cached;
      }

      // A last-known fix is instant and good enough for a 10 km radius.
      const last = await withTimeout(
        Location.getLastKnownPositionAsync({
          maxAge: FIX_TTL_MS,
          requiredAccuracy: 5000,
        }),
        LAST_KNOWN_TIMEOUT_MS,
      ).catch(() => null);
      if (last) {
        const fix = { lat: last.coords.latitude, lng: last.coords.longitude };
        cachedFix = { fix, at: Date.now() };
        setCoords(fix);
      }

      try {
        // Balanced uses the fused provider; if that does not answer, the
        // lower-accuracy (network) provider is a better fix than no card.
        const current = await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          CURRENT_FIX_TIMEOUT_MS,
        ).catch(() =>
          withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            }),
            CURRENT_FIX_TIMEOUT_MS,
          ),
        );
        const fix = {
          lat: current.coords.latitude,
          lng: current.coords.longitude,
        };
        cachedFix = { fix, at: Date.now() };
        setCoords(fix);
        setError(null);
        return fix;
      } catch {
        if (last) {
          const fix = { lat: last.coords.latitude, lng: last.coords.longitude };
          return fix;
        }
        setError("Could not get your location.");
        setPermission("error");
        return null;
      }
    }, []);

  /** Prompts once; returns the state and fix the caller should surface. */
  const request = useCallback(async (): Promise<CurrentLocationResult> => {
    if (requesting.current) return { permission: "requesting", fix: null };
    requesting.current = true;
    setPermission("requesting");
    setError(null);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      applyStatus(result.status, result.canAskAgain);
      if (result.status !== "granted") {
        return {
          permission: result.canAskAgain ? "denied" : "blocked",
          fix: null,
        };
      }
      const fix = await readPosition();
      return fix
        ? { permission: "granted", fix }
        : { permission: "error", fix: null };
    } catch {
      setError("Could not request location permission.");
      setPermission("error");
      return { permission: "error", fix: null };
    } finally {
      requesting.current = false;
    }
  }, [applyStatus, readPosition]);

  /** Re-read the permission and, when granted, refresh the fix. */
  const refresh = useCallback(async () => {
    const current = await Location.getForegroundPermissionsAsync().catch(
      () => null,
    );
    if (!current) return;
    applyStatus(current.status, current.canAskAgain);
    if (current.status === "granted") await readPosition();
  }, [applyStatus, readPosition]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { permission, coords, error, request, refresh, openSettings };
}
