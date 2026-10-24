"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  KeyRound,
  Loader2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useE2eBackupContext } from "@/components/chat/e2e-backup-provider";

const DISMISS_KEY = "e2e-backup-passcode-dismissed";

function readDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${DISMISS_KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Chat-history backup banners for the thread column. The backup itself (and
 * every dialog) lives in the app-wide E2eBackupProvider; this panel only
 * surfaces state and opens the provider's flows:
 *  - this device can't read older history → restore with the backup
 *    passcode, or ask another signed-in device to approve;
 *  - this device holds the backup but no passcode is set → nudge to set one;
 *  - the status read failed → retry.
 */
export function E2eBackupPanel() {
  const t = useTranslations("Chat.backup");
  const tMessage = useTranslations("Chat.message");
  const backup = useE2eBackupContext();
  const [dismissedNow, setDismissedNow] = useState(false);
  const userId = backup?.userId ?? null;
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

  if (!backup) return null;
  const { state, requestState } = backup;

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
              <Button size="sm" onClick={backup.openRestore}>
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

      {state?.kind === "error" && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/60 px-4 py-2 text-sm">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">{t("genericError")}</span>
          <Button size="sm" variant="outline" onClick={backup.retry}>
            {tMessage("retry")}
          </Button>
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
          <Button size="sm" onClick={backup.openSetPasscode}>
            {t("setPasscode")}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t("notNow")}
          </Button>
        </div>
      )}
    </>
  );
}
