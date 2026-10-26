"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryRequest } from "@/actions/e2e-backup";
import { useNotificationEvents } from "@/hooks/use-chat-ws";
import {
  E2E_PLAINTEXT_CACHED,
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
import { actionForPush } from "@/lib/e2e/push-events";
import type { RatchetEngine } from "@/lib/e2e/types";
import { startVisiblePoller } from "@/lib/polling/visible-poller";
import type { VisiblePoller } from "@/lib/polling/visible-poller";

const SYNC_INTERVAL_MS = 60_000;
const APPROVALS_POLL_MS = 20_000;
const REQUEST_POLL_MS = 10_000;
/**
 * While the realtime socket is up the backend pushes every change (see
 * `lib/e2e/push-events.ts`), so these are only a safety net for a push that
 * went missing. Without a socket the three intervals above apply.
 */
const SAFETY_SYNC_MS = 300_000;
const SAFETY_APPROVALS_MS = 300_000;
const SAFETY_REQUEST_MS = 60_000;
/** A push sent while the socket was down is not replayed: catch up on reconnect unless we just ran. */
const CONNECT_CATCH_UP_MS = 2_000;
/** Backoff before retrying a failed backup-status read. */
const ERROR_RETRY_MS = 30_000;
/** Debounce for the upload kicked off by freshly cached plaintext. */
const CACHED_SYNC_DEBOUNCE_MS = 5_000;
/** At most one automatic history request per (user, device) per session. */
const AUTO_REQUEST_KEY = "e2e-backup-auto-request";

export type ApprovalRequestState =
  | "idle"
  | "pending"
  | "declined"
  | "expired"
  | "restored"
  | "error";

/** Which backup dialog the provider should render. */
export type BackupDialog = "none" | "restore" | "enter" | "set";

export interface E2eBackupApi {
  /** The account this backup belongs to (null before the engine boots). */
  userId: string | null;
  state: BackupState | null;
  /** This device's own "please send me history" request. */
  requestState: ApprovalRequestState;
  /** Other devices asking THIS one for access (approver side). */
  incoming: HistoryRequest[];
  lastRestoredCount: number | null;
  /** The dialog the provider must render right now. */
  dialog: BackupDialog;
  setDialog(dialog: BackupDialog): void;
  /** Open the restore dialog (passcode form if known, or ask another device). */
  openRestore(): void;
  /** Open the "set a backup passcode" dialog. */
  openSetPasscode(): void;
  /** Retry the backup-status read after a failure. */
  retry(): void;
  enterPasscode(passcode: string): Promise<PasscodeResult>;
  savePasscode(
    passcode: string,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  askOtherDevice(): Promise<void>;
  approve(request: HistoryRequest): Promise<boolean>;
  decline(request: HistoryRequest): Promise<void>;
}

function autoRequested(userId: string, deviceId: string): boolean {
  try {
    return (
      sessionStorage.getItem(`${AUTO_REQUEST_KEY}:${userId}:${deviceId}`) ===
      "1"
    );
  } catch {
    return false;
  }
}

function markAutoRequested(userId: string, deviceId: string): void {
  try {
    sessionStorage.setItem(`${AUTO_REQUEST_KEY}:${userId}:${deviceId}`, "1");
  } catch {
    /* private mode — asking again next session is harmless */
  }
}

/**
 * Drives the history backup for the signed-in device:
 *   ready  → upload new plaintext and pull new segments every minute (one
 *            visible tab per browser), watch for other devices asking for
 *            access (and let the user approve); nothing polls in a hidden tab;
 *   locked → offer passcode restore, or ask another device and poll until
 *            it approves (reporting an incoming approval on any page).
 *
 * Every backup route is device-scoped, so nothing runs until the engine has
 * resolved `deviceId` — an account backup can only be used by an active device.
 */
export function useE2eBackup(engine: RatchetEngine | null): E2eBackupApi {
  const [state, setState] = useState<BackupState | null>(null);
  const [requestState, setRequestState] =
    useState<ApprovalRequestState>("idle");
  const [incoming, setIncoming] = useState<HistoryRequest[]>([]);
  const [lastRestoredCount, setLastRestoredCount] = useState<number | null>(
    null,
  );
  const [dialog, setDialog] = useState<BackupDialog>("none");
  const userId = engine?.userId ?? null;
  const deviceId = engine?.deviceId ?? null;

  // The three pollers below register here so a push (or a socket change) can
  // nudge them; `socketUp` is what they read to pick their cadence.
  const pollers = useRef<{
    sync?: VisiblePoller;
    approvals?: VisiblePoller;
    request?: VisiblePoller;
  }>({});
  const socketUp = useRef(false);
  const { isConnected } = useNotificationEvents({
    enabled: Boolean(engine && deviceId),
    onNotification: (notification) => {
      const action = deviceId ? actionForPush(notification, deviceId) : null;
      if (action === "refresh-approvals") pollers.current.approvals?.poke();
      else if (action === "check-approval") pollers.current.request?.poke();
      else if (action === "pull-backup") pollers.current.sync?.poke();
    },
  });
  useEffect(() => {
    socketUp.current = isConnected;
    for (const poller of Object.values(pollers.current)) {
      if (isConnected) poller.poke({ ifOlderThanMs: CONNECT_CATCH_UP_MS });
      else poller.retime();
    }
  }, [isConnected]);

  const loadState = useCallback(async (): Promise<BackupState | null> => {
    if (!userId || !deviceId) return null;
    try {
      return await ensureBackup(userId, deviceId);
    } catch (err) {
      return {
        kind: "error",
        message: err instanceof Error ? err.message : "backup unavailable",
      };
    }
  }, [userId, deviceId]);

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

  // A failed status read is transient (offline, deploy): retry with backoff.
  useEffect(() => {
    if (state?.kind !== "error") return;
    const timer = setTimeout(() => void refresh(), ERROR_RETRY_MS);
    return () => clearTimeout(timer);
  }, [state, refresh]);

  // Resume a request made before a reload, and — when this device has no
  // request yet — ask the other devices once per session so an existing
  // device gets prompted. Never retried automatically after a decline or an
  // expiry: the panel then offers "Ask my other device" again.
  useEffect(() => {
    if (!engine || !userId || !deviceId || state?.kind !== "locked") return;
    let cancelled = false;
    void checkApproval(engine).then((r) => {
      if (cancelled) return;
      if (
        r.status === "pending" ||
        r.status === "declined" ||
        r.status === "expired"
      ) {
        setRequestState(r.status);
        return;
      }
      if (r.status === "restored") {
        setLastRestoredCount(r.restored);
        setRequestState("restored");
        void refresh();
        return;
      }
      if (r.status !== "none" || autoRequested(userId, deviceId)) return;
      markAutoRequested(userId, deviceId);
      void requestApproval(engine).then((res) => {
        if (!cancelled) setRequestState(res.ok ? "pending" : "error");
      });
    });
    return () => {
      cancelled = true;
    };
  }, [engine, userId, deviceId, state?.kind, refresh]);

  // Ready: upload and pull independently, and watch for approval requests.
  // Upload and pull each get their own catch so a failed upload never starves
  // the pull (and vice versa).
  useEffect(() => {
    if (!engine || !userId || !deviceId || state?.kind !== "ready") return;
    const upload = () =>
      syncBackup(userId, deviceId).catch((err: unknown) => {
        console.warn("[e2e] backup upload failed; will retry", err);
      });
    const pull = () =>
      pullBackup(userId, deviceId).catch((err: unknown) => {
        console.warn("[e2e] backup pull failed; will retry", err);
      });
    const sync = () => Promise.allSettled([upload(), pull()]);
    const poll = () => listPendingApprovals(engine).then(setIncoming);
    // Both only run while this tab is visible (a hidden tab's throttled timer
    // wakes the backend once a minute for nobody), and the account-level sync
    // runs in one visible tab per browser (a push pokes only that tab's
    // poller). Approvals stay per tab on purpose: the dialog has to show up in
    // the tab the user is looking at. Socket up: slow safety poll, the pushes do
    // the work. Socket down: the 20 s / 60 s cadence, which also keeps the
    // backend warm for that user.
    const sync_ = startVisiblePoller({
      run: sync,
      intervalMs: () => (socketUp.current ? SAFETY_SYNC_MS : SYNC_INTERVAL_MS),
      leaderKey: `e2e-backup-sync:${userId}:${deviceId}`,
    });
    const approvals = startVisiblePoller({
      run: poll,
      intervalMs: () =>
        socketUp.current ? SAFETY_APPROVALS_MS : APPROVALS_POLL_MS,
    });
    const registered = pollers.current;
    registered.sync = sync_;
    registered.approvals = approvals;
    return () => {
      registered.sync = undefined;
      registered.approvals = undefined;
      sync_();
      approvals();
    };
  }, [engine, userId, deviceId, state?.kind]);

  // Newly cached plaintext: upload it promptly (debounced — a page of history
  // decrypts in one burst).
  useEffect(() => {
    if (!userId || !deviceId || state?.kind !== "ready") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onCached = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void syncBackup(userId, deviceId).catch((err: unknown) => {
          console.warn("[e2e] backup upload failed; will retry", err);
        });
      }, CACHED_SYNC_DEBOUNCE_MS);
    };
    window.addEventListener(E2E_PLAINTEXT_CACHED, onCached);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(E2E_PLAINTEXT_CACHED, onCached);
    };
  }, [userId, deviceId, state?.kind]);

  // Locked + waiting on another device.
  useEffect(() => {
    if (!engine || requestState !== "pending") return;
    const request = startVisiblePoller({
      intervalMs: () =>
        socketUp.current ? SAFETY_REQUEST_MS : REQUEST_POLL_MS,
      run: () =>
        checkApproval(engine).then((r) => {
          if (r.status === "restored") {
            setLastRestoredCount(r.restored);
            setRequestState("restored");
            void refresh();
          } else if (r.status === "declined" || r.status === "expired") {
            setRequestState(r.status);
          } else if (r.status === "error") {
            setRequestState("error");
          }
        }),
    });
    const registered = pollers.current;
    registered.request = request;
    return () => {
      registered.request = undefined;
      request();
    };
  }, [engine, requestState, refresh]);

  const enterPasscode = useCallback(
    async (passcode: string) => {
      if (!userId || !deviceId)
        return {
          ok: false as const,
          reason: "error" as const,
          message: "not ready",
        };
      const result = await restoreWithPasscode(userId, deviceId, passcode);
      if (result.ok) {
        setLastRestoredCount(result.restored);
        await refresh();
      }
      return result;
    },
    [userId, deviceId, refresh],
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
    if (!engine || !deviceId) return;
    const res = await requestApproval(engine);
    setRequestState(res.ok ? "pending" : "error");
  }, [engine, deviceId]);

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

  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);

  const openRestore = useCallback(() => setDialog("restore"), []);
  const openSetPasscode = useCallback(() => setDialog("set"), []);

  return {
    userId,
    state,
    requestState,
    incoming,
    lastRestoredCount,
    dialog,
    setDialog,
    openRestore,
    openSetPasscode,
    retry,
    enterPasscode,
    savePasscode,
    askOtherDevice,
    approve,
    decline,
  };
}
