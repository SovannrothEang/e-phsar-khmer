"use client";

import { createContext, useContext, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useE2eEngine } from "@/hooks/use-e2e-engine";
import { useE2eBackup } from "@/hooks/use-e2e-backup";
import type { E2eBackupApi } from "@/hooks/use-e2e-backup";
import { MIN_PASSCODE_LENGTH } from "@/lib/e2e/backup-crypto";
import type { HistoryRequest } from "@/actions/e2e-backup";

const E2eBackupContext = createContext<E2eBackupApi | null>(null);

/** The app-wide history-backup surface (null outside the provider). */
export function useE2eBackupContext(): E2eBackupApi | null {
  return useContext(E2eBackupContext);
}

/**
 * Mounted once per signed-in app shell (the (user) and (chat) layouts).
 *
 * The backup must run even when the chat page is closed: uploads, pulls, the
 * new-device approval prompt and the restore flows are all global. The
 * provider owns the single useE2eBackup instance, exposes it through context,
 * and renders its dialogs at the app root so any page can open the restore
 * flow.
 */
export function E2eBackupProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const engine = useE2eEngine(userId);
  const backup = useE2eBackup(engine);

  return (
    <E2eBackupContext.Provider value={backup}>
      {children}
      <E2eBackupDialogs backup={backup} />
    </E2eBackupContext.Provider>
  );
}

function E2eBackupDialogs({ backup }: { backup: E2eBackupApi }) {
  const request = backup.incoming[0] ?? null;
  return (
    <>
      <ApproveRequestDialog request={request} backup={backup} />
      <RestoreDialog backup={backup} />
      <EnterPasscodeDialog
        open={backup.dialog === "enter"}
        onOpenChange={(open) => backup.setDialog(open ? "enter" : "none")}
        onSubmit={backup.enterPasscode}
      />
      <SetPasscodeDialog
        open={backup.dialog === "set"}
        onOpenChange={(open) => backup.setDialog(open ? "set" : "none")}
        onSubmit={backup.savePasscode}
      />
    </>
  );
}

/** Another device asks this one for the backup key. */
function ApproveRequestDialog({
  request,
  backup,
}: {
  request: HistoryRequest | null;
  backup: E2eBackupApi;
}) {
  const t = useTranslations("Chat.backup");
  return (
    <Dialog open={request !== null}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("approveTitle")}</DialogTitle>
          <DialogDescription>
            {t("approveDescription", {
              device: request?.requesterLabel ?? t("unknownDevice"),
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => request && void backup.decline(request)}
          >
            {t("decline")}
          </Button>
          <Button onClick={() => request && void backup.approve(request)}>
            {t("allow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Opened by openRestore(): the passcode form (when the account has one) and
 * the "ask my other device" fallback, with the waiting/declined states.
 */
function RestoreDialog({ backup }: { backup: E2eBackupApi }) {
  const t = useTranslations("Chat.backup");
  const { state, requestState } = backup;
  const locked = state?.kind === "locked" ? state : null;

  return (
    <Dialog
      open={backup.dialog === "restore"}
      onOpenChange={(open) => backup.setDialog(open ? "restore" : "none")}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("lockedTitle")}</DialogTitle>
          <DialogDescription>
            {locked && !locked.hasPasscode
              ? t("lockedNoPasscode")
              : t("lockedDescription")}
          </DialogDescription>
        </DialogHeader>
        {requestState === "pending" && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {t("waitingApproval")}
          </p>
        )}
        {requestState === "declined" && (
          <p className="text-sm text-destructive">{t("declined")}</p>
        )}
        {requestState === "expired" && (
          <p className="text-sm text-muted-foreground">{t("expired")}</p>
        )}
        {requestState === "error" && (
          <p className="text-sm text-destructive">{t("genericError")}</p>
        )}
        <DialogFooter>
          {locked?.hasPasscode && (
            <Button onClick={() => backup.setDialog("enter")}>
              <KeyRound className="size-4" />
              {t("enterPasscode")}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={requestState === "pending"}
            onClick={() => void backup.askOtherDevice()}
          >
            <Smartphone className="size-4" />
            {t("askOtherDevice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnterPasscodeDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: E2eBackupApi["enterPasscode"];
}) {
  const t = useTranslations("Chat.backup");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit(value);
    setBusy(false);
    if (result.ok) {
      setValue("");
      onOpenChange(false);
      return;
    }
    if (result.reason === "wrong")
      setError(t("wrongPasscode", { count: result.attemptsLeft }));
    else if (result.reason === "locked")
      setError(
        t("lockedOut", {
          time: result.lockedUntil
            ? new Date(result.lockedUntil).toLocaleTimeString()
            : "—",
        }),
      );
    else setError(t("genericError"));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("enterTitle")}</DialogTitle>
            <DialogDescription>{t("enterDescription")}</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("passcodePlaceholder")}
            disabled={busy}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={!value || busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? t("unlocking") : t("unlock")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SetPasscodeDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: E2eBackupApi["savePasscode"];
}) {
  const t = useTranslations("Chat.backup");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (first.length < MIN_PASSCODE_LENGTH)
      return setError(t("tooShort", { count: MIN_PASSCODE_LENGTH }));
    if (first !== second) return setError(t("mismatch"));
    setBusy(true);
    setError(null);
    const result = await onSubmit(first);
    setBusy(false);
    if (result.ok) {
      setFirst("");
      setSecond("");
      onOpenChange(false);
    } else setError(t("genericError"));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("setTitle")}</DialogTitle>
            <DialogDescription>
              {t("setDescription", { count: MIN_PASSCODE_LENGTH })}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoComplete="new-password"
            autoFocus
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder={t("passcodePlaceholder")}
            disabled={busy}
          />
          <Input
            type="password"
            autoComplete="new-password"
            value={second}
            onChange={(e) => setSecond(e.target.value)}
            placeholder={t("confirmPlaceholder")}
            disabled={busy}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
