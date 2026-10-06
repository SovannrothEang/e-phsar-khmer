"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
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
import { useE2eBackup } from "@/hooks/use-e2e-backup";
import { MIN_PASSCODE_LENGTH } from "@/lib/e2e/backup-crypto";
import type { RatchetEngine } from "@/lib/e2e/types";

const DISMISS_KEY = "e2e-backup-passcode-dismissed";

function readDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${DISMISS_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Chat-history backup surface for the thread column:
 *  - this device can't read older history → restore with the backup
 *    passcode, or ask another signed-in device to approve;
 *  - this device holds the backup but no passcode is set → nudge to set one;
 *  - another device is asking for access → approve/decline dialog.
 */
export function E2eBackupPanel({ engine }: { engine: RatchetEngine | null }) {
  const t = useTranslations("Chat.backup");
  const backup = useE2eBackup(engine);
  const { state, requestState, incoming } = backup;

  const [enterOpen, setEnterOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [dismissedNow, setDismissedNow] = useState(false);
  const userId = engine?.userId ?? null;
  // The panel only renders anything after the engine resolved on the client,
  // so reading localStorage here never diverges from the server render.
  const dismissed = dismissedNow || !userId || readDismissed(userId);

  const dismiss = () => {
    setDismissedNow(true);
    try {
      if (userId) localStorage.setItem(`${DISMISS_KEY}:${userId}`, "1");
    } catch {
      /* private mode — dismiss for this visit only */
    }
  };

  const request = incoming[0] ?? null;

  return (
    <>
      {state?.kind === "locked" && (
        <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-muted/60 px-4 py-3 text-sm">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium">{t("lockedTitle")}</p>
              <p className="text-muted-foreground">
                {state.hasPasscode
                  ? t("lockedDescription")
                  : t("lockedNoPasscode")}
              </p>
              {requestState === "pending" && (
                <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t("waitingApproval")}
                </p>
              )}
              {requestState === "declined" && (
                <p className="mt-1 text-destructive">{t("declined")}</p>
              )}
              {requestState === "expired" && (
                <p className="mt-1 text-muted-foreground">{t("expired")}</p>
              )}
              {requestState === "error" && (
                <p className="mt-1 text-destructive">{t("genericError")}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-6">
            {state.hasPasscode && (
              <Button size="sm" onClick={() => setEnterOpen(true)}>
                {t("enterPasscode")}
              </Button>
            )}
            {requestState !== "pending" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void backup.askOtherDevice()}
              >
                <Smartphone className="size-4" />
                {t("askOtherDevice")}
              </Button>
            )}
          </div>
        </div>
      )}

      {state?.kind === "ready" && backup.lastRestoredCount !== null && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/60 px-4 py-2 text-sm">
          <ShieldCheck className="size-4 text-green-600" />
          <span>{t("restored", { count: backup.lastRestoredCount })}</span>
        </div>
      )}

      {state?.kind === "ready" && !state.hasPasscode && !dismissed && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/60 px-4 py-2 text-sm">
          <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">{t("setNudge")}</span>
          <Button size="sm" onClick={() => setSetOpen(true)}>
            {t("setPasscode")}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t("notNow")}
          </Button>
        </div>
      )}

      <EnterPasscodeDialog
        open={enterOpen}
        onOpenChange={setEnterOpen}
        onSubmit={backup.enterPasscode}
      />
      <SetPasscodeDialog
        open={setOpen}
        onOpenChange={setSetOpen}
        onSubmit={backup.savePasscode}
      />

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
    </>
  );
}

function EnterPasscodeDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: ReturnType<typeof useE2eBackup>["enterPasscode"];
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
  onSubmit: ReturnType<typeof useE2eBackup>["savePasscode"];
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
