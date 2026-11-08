"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** The contact channels a suspended account can appeal through, all optional. */
export interface SuspensionSupport {
  email?: string;
  telegram?: string;
  phone?: string;
}

export interface SuspensionInfo {
  /** The staff-written reason, when the suspension recorded one. */
  reason: string | null;
  support: SuspensionSupport;
}

/**
 * The only surface a suspended account can see.
 *
 * A suspension blocks every sign-in path, so there is no page, feed or
 * notification the blocked user can open — the login (or OTP-verify) failure
 * is where the reason and the appeal channels have to live. Channels come from
 * the runtime settings, so an unset one is simply absent.
 *
 * Shared by both auth forms: a suspension reaches `/auth/login` and
 * `/auth/otp/verify` alike, and neither should show it as a toast.
 */
export function SuspendedDialog({
  info,
  onClose,
}: {
  info: SuspensionInfo | null;
  onClose: () => void;
}) {
  const support = info?.support ?? {};
  const contacts = [
    support.email ? { label: "Email", value: support.email } : null,
    support.telegram ? { label: "Telegram", value: support.telegram } : null,
    support.phone ? { label: "Phone", value: support.phone } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <Dialog
      open={info !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>This account is suspended</DialogTitle>
          <DialogDescription>
            {info?.reason ??
              "An administrator has suspended this account. You cannot sign in until it is reviewed."}
          </DialogDescription>
        </DialogHeader>
        {contacts.length > 0 ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">Contact us to resolve it:</p>
            <ul className="flex flex-col gap-1">
              {contacts.map((row) => (
                <li key={row.label}>
                  <span className="text-muted-foreground">{row.label}:</span>{" "}
                  <span className="break-all">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Contact support through the app&apos;s help channels to request a
            review.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
