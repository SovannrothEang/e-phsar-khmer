"use client";

import { useCallback, useEffect, useState } from "react";
import type { HistoryRequest } from "@/actions/e2e-backup";
import {
  approveRequest,
  checkApproval,
  declineRequest,
  ensureBackup,
  listPendingApprovals,
  pullBackup,
  requestApproval,
  restoreWithPasscode,
  setPasscode,
  syncBackup,
} from "@/lib/e2e/backup";
import type { BackupState, PasscodeResult } from "@/lib/e2e/backup";
import type { RatchetEngine } from "@/lib/e2e/types";

const SYNC_INTERVAL_MS = 60_000;
const APPROVALS_POLL_MS = 20_000;
const REQUEST_POLL_MS = 10_000;

export type ApprovalRequestState =
  | "idle"
  | "pending"
  | "declined"
  | "expired"
  | "restored"
  | "error";

export interface E2eBackupApi {
  state: BackupState | null;
  /** This device's own "please send me history" request. */
  requestState: ApprovalRequestState;
  /** Other devices asking THIS one for access (approver side). */
  incoming: HistoryRequest[];
  lastRestoredCount: number | null;
  enterPasscode(passcode: string): Promise<PasscodeResult>;
  savePasscode(
    passcode: string,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  askOtherDevice(): Promise<void>;
  approve(request: HistoryRequest): Promise<boolean>;
  decline(request: HistoryRequest): Promise<void>;
}

/**
 * Drives the history backup for the signed-in device:
 *   ready  → upload new plaintext every minute, watch for other devices
 *            asking for access (and let the user approve them);
 *   locked → offer passcode restore, or ask another device and poll until
 *            it approves.
 */
export function useE2eBackup(engine: RatchetEngine | null): E2eBackupApi {
  const [state, setState] = useState<BackupState | null>(null);
  const [requestState, setRequestState] =
    useState<ApprovalRequestState>("idle");
  const [incoming, setIncoming] = useState<HistoryRequest[]>([]);
  const [lastRestoredCount, setLastRestoredCount] = useState<number | null>(
    null,
  );
  const userId = engine?.userId ?? null;
  const deviceId = engine?.deviceId ?? null;

  const loadState = useCallback(async (): Promise<BackupState | null> => {
    if (!userId) return null;
    try {
      return await ensureBackup(userId);
    } catch (err) {
      return {
        kind: "error",
        message: err instanceof Error ? err.message : "backup unavailable",
      };
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    const next = await loadState();
    if (next) setState(next);
  }, [loadState]);

  useEffect(() => {
    let cancelled = false;
    void loadState().then((next) => {
      if (!cancelled && next) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [loadState]);

  // Resume a request made before a reload.
  useEffect(() => {
    if (!engine || state?.kind !== "locked") return;
    void checkApproval(engine).then((r) => {
      if (
        r.status === "pending" ||
        r.status === "declined" ||
        r.status === "expired"
      )
        setRequestState(r.status);
      if (r.status === "restored") {
        setLastRestoredCount(r.restored);
        setRequestState("restored");
        void refresh();
      }
    });
  }, [engine, state?.kind, refresh]);

  // Ready: keep uploading + watch for approval requests.
  useEffect(() => {
    if (!engine || !userId || !deviceId || state?.kind !== "ready") return;
    const sync = () =>
      void syncBackup(userId, deviceId)
        .then(() => pullBackup(userId))
        .catch(() => {});
    const poll = () => void listPendingApprovals(engine).then(setIncoming);
    sync();
    poll();
    const syncTimer = setInterval(sync, SYNC_INTERVAL_MS);
    const pollTimer = setInterval(poll, APPROVALS_POLL_MS);
    return () => {
      clearInterval(syncTimer);
      clearInterval(pollTimer);
    };
  }, [engine, userId, deviceId, state?.kind]);

  // Locked + waiting on another device.
  useEffect(() => {
    if (!engine || requestState !== "pending") return;
    const timer = setInterval(() => {
      void checkApproval(engine).then((r) => {
        if (r.status === "restored") {
          setLastRestoredCount(r.restored);
          setRequestState("restored");
          void refresh();
        } else if (r.status === "declined" || r.status === "expired") {
          setRequestState(r.status);
        } else if (r.status === "error") {
          setRequestState("error");
        }
      });
    }, REQUEST_POLL_MS);
    return () => clearInterval(timer);
  }, [engine, requestState, refresh]);

  const enterPasscode = useCallback(
    async (passcode: string) => {
      if (!userId)
        return {
          ok: false as const,
          reason: "error" as const,
          message: "not ready",
        };
      const result = await restoreWithPasscode(userId, passcode);
      if (result.ok) {
        setLastRestoredCount(result.restored);
        await refresh();
      }
      return result;
    },
    [userId, refresh],
  );

  const savePasscode = useCallback(
    async (passcode: string) => {
      if (!userId) return { ok: false as const, message: "not ready" };
      const result = await setPasscode(userId, passcode);
      if (result.ok) await refresh();
      return result;
    },
    [userId, refresh],
  );

  const askOtherDevice = useCallback(async () => {
    if (!engine) return;
    const res = await requestApproval(engine);
    setRequestState(res.ok ? "pending" : "error");
  }, [engine]);

  const approve = useCallback(
    async (request: HistoryRequest) => {
      if (!engine) return false;
      const res = await approveRequest(engine, request);
      setIncoming((prev) => prev.filter((r) => r.id !== request.id));
      return res.ok;
    },
    [engine],
  );

  const decline = useCallback(
    async (request: HistoryRequest) => {
      if (!engine) return;
      await declineRequest(engine, request);
      setIncoming((prev) => prev.filter((r) => r.id !== request.id));
    },
    [engine],
  );

  return {
    state,
    requestState,
    incoming,
    lastRestoredCount,
    enterPasscode,
    savePasscode,
    askOtherDevice,
    approve,
    decline,
  };
}
