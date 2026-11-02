"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldMinus, Trash2 } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import type { Post } from "@/lib/posts";
import { inactivateListing, removeListing } from "@/actions/admin-listings";
import { useModerator } from "./moderator-provider";

/** Same row box as every other kebab row (see ThreeDotPost). */
const ITEM =
  "flex w-full items-center gap-3 px-3 py-2 type-nav cursor-pointer outline-none transition-colors hover:bg-muted";
const ICON = "size-[18px] shrink-0";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Action = "inactive" | "remove";

/**
 * Admin-only rows for a listing card's three-dot menu, plus the reason dialog
 * that drives them.
 *
 * Returns `menuItems` (goes inside the DropdownMenuContent) and `dialog`
 * (rendered outside it — a Radix menu unmounts its content when it closes, so
 * a dialog kept inside would vanish the moment the row is picked).
 *
 * Shown only when an admin dashboard session is live in this browser; every
 * action is still authorized server-side by the admin token, so the flag is
 * purely cosmetic. Real listings only: legacy/mock ids are not UUIDs and have
 * no row to moderate.
 */
export function useStaffListingActions(post: Post) {
  const { isModerator, hideListing } = useModerator();
  const t = useTranslations("Moderation");
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const id = String(post.postId);
  const eligible = isModerator && UUID_RE.test(id);

  const close = () => {
    if (busy) return;
    setAction(null);
    setReason("");
  };

  const submit = async () => {
    if (!action || !reason.trim() || busy) return;
    setBusy(true);
    const result =
      action === "remove"
        ? await removeListing(id, reason)
        : await inactivateListing(id, reason);
    setBusy(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(action === "remove" ? t("removeDone") : t("inactiveDone"));
    setAction(null);
    setReason("");
    // Drop the card immediately (the admin is looking at it); the refresh then
    // re-renders the list from the server so a later navigation agrees.
    hideListing(id);
    router.refresh();
  };

  const menuItems = eligible ? (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild className="p-0">
        <button
          type="button"
          onClick={() => setAction("inactive")}
          className={ITEM}
        >
          <ShieldMinus className={ICON} strokeWidth={1.5} />
          <span>{t("setInactive")}</span>
        </button>
      </DropdownMenuItem>
      <DropdownMenuItem asChild className="p-0">
        <button
          type="button"
          onClick={() => setAction("remove")}
          className={`${ITEM} text-destructive hover:bg-destructive/10`}
        >
          <Trash2 className={ICON} strokeWidth={1.5} />
          <span>{t("deletePost")}</span>
        </button>
      </DropdownMenuItem>
    </>
  ) : null;

  const dialog = eligible ? (
    <Dialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === "remove" ? t("removeTitle") : t("inactiveTitle")}
          </DialogTitle>
          <DialogDescription>
            {action === "remove"
              ? t("removeBody", { title: post.title })
              : t("inactiveBody", { title: post.title })}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          placeholder={t("reasonPlaceholder")}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-9 cursor-pointer rounded-sm"
            onClick={close}
            disabled={busy}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => void submit()}
            className={`h-9 cursor-pointer rounded-sm text-white ${
              action === "remove"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-sky-500 hover:bg-sky-600"
            }`}
          >
            {busy
              ? t("saving")
              : action === "remove"
                ? t("confirmRemove")
                : t("confirmInactive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { menuItems, dialog };
}
