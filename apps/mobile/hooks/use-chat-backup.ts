import { useCallback, useEffect, useState } from "react";
import { fetchBackupStatus } from "@/lib/api/backup";
import {
  pullBackup,
  restoreWithPasscode,
  type RestoreResult,
} from "@/lib/e2e/backup";
import { keyCheckOf } from "@/lib/e2e/backup-crypto";
import { base64ToBytes } from "@/lib/e2e/crypto/base64";
import { loadIdentity } from "@/lib/e2e/store";

/**
 * Where this phone stands with the account's chat-history backup.
 *
 *  - `ready`      the phone holds the backup key: anything still locked is
 *                 simply not in the backup, so asking for the passcode again
 *                 could never reveal it;
 *  - `restorable` no key here, but the account has a passcode to restore with;
 *  - `no-passcode` / `no-backup`
 *                 there is nothing the user could enter at all.
 *
 * The state exists so the thread never offers a passcode field it cannot use.
 */
export type ChatBackupState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "restorable"; lockedUntil: string | null }
  | { kind: "no-passcode" }
  | { kind: "no-backup" }
  | { kind: "error"; message: string };

export function useChatBackup(userId: string | null, deviceId: string | null) {
  const [state, setState] = useState<ChatBackupState>({ kind: "loading" });

  const load = useCallback(async () => {
    if (!userId || !deviceId) return;
    setState({ kind: "loading" });
    try {
      const status = await fetchBackupStatus();
      const identity = await loadIdentity(userId);
      if (identity?.backupKey) {
        // A key left over from an older account backup is not this one.
        const holds =
          !status.keyCheck ||
          keyCheckOf(base64ToBytes(identity.backupKey)) === status.keyCheck;
        if (holds) {
          setState({ kind: "ready" });
          return;
        }
      }
      if (!status.exists) {
        setState({ kind: "no-backup" });
      } else if (!status.hasPasscode) {
        setState({ kind: "no-passcode" });
      } else {
        setState({ kind: "restorable", lockedUntil: status.lockedUntil });
      }
    } catch {
      setState({ kind: "error", message: "Could not check your chat backup." });
    }
  }, [userId, deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = useCallback(
    async (passcode: string): Promise<RestoreResult> => {
      if (!userId || !deviceId) {
        return {
          ok: false,
          reason: "error",
          message: "Chat encryption is not ready yet.",
        };
      }
      const result = await restoreWithPasscode(userId, deviceId, passcode);
      if (result.ok) setState({ kind: "ready" });
      else if (result.reason === "no-passcode")
        setState({ kind: "no-passcode" });
      else if (result.reason === "no-backup") setState({ kind: "no-backup" });
      return result;
    },
    [userId, deviceId],
  );

  /** Pick up segments another device uploaded since the last pull. */
  const pull = useCallback(async (): Promise<number> => {
    if (!userId || !deviceId) return 0;
    return pullBackup(userId, deviceId);
  }, [userId, deviceId]);

  return { state, refresh: load, restore, pull };
}
