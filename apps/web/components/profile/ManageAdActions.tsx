"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CircleArrowUp,
  EllipsisVertical,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { toSlug } from "@/lib/utils";
import { deleteMyListing, renewMyListing } from "@/actions/my-ads";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Post } from "@/lib/posts";

const ITEM =
  "flex w-full items-center gap-3 px-3 py-2 type-nav cursor-pointer outline-none transition-colors hover:bg-muted";

/**
 * The owner's actions on one Manage Ads row (captain, 2026-10-27): the row
 * shows the ad, this menu is what the user can do with it.
 *
 * Only actions the backend really supports are offered: view, edit (the web
 * edit screen — the backend already allows editing restricted ads too), renew
 * (`POST /listings/:id/publish` — 30 more days, one renewal from the plan)
 * and delete (soft-delete). There is no "sold" status, so it does not appear.
 */
export function ManageAdActions({
  post,
  hidden = false,
  inactive = false,
  onChanged,
}: {
  post: Post;
  /** A hidden ad has no public page and cannot be renewed until a slot frees. */
  hidden?: boolean;
  /** A staff-inactive ad: no public page, and only staff can lift it. */
  inactive?: boolean;
  /** Called after a successful renew/delete so the list reloads. */
  onChanged: () => void;
}) {
  const t = useTranslations("Me.manageAds");
  const tShare = useTranslations("Share");
  const [confirm, setConfirm] = useState<"renew" | "delete" | null>(null);
  // Closing must not clear `confirm`: the dialog keeps rendering its content
  // through the close animation, and clearing it flipped the title/button to
  // the "Renew" fallback for a moment (captain, 2026-11-03).
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const id = String(post.postId);
  const href = `/${toSlug(post.title)}-adid-${id}`;

  async function run() {
    if (!confirm || pending) return;
    setPending(true);
    // Renew (including a first publish) goes through the same backend door;
    // the backend decides whether it spends a renewal.
    const result =
      confirm === "delete"
        ? await deleteMyListing(id)
        : await renewMyListing(id);
    setPending(false);

    if (!result.success) {
      toast.error(result.error ?? t("actionError"));
      return;
    }
    toast.success(confirm === "delete" ? t("deleted") : t("renewed"));
    setDialogOpen(false);
    onChanged();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("actions")}
            onClick={(event) => event.stopPropagation()}
            className="cursor-pointer rounded-full p-2 text-muted-foreground outline-none transition-colors hover:bg-muted"
          >
            <EllipsisVertical size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          onClick={(event) => event.stopPropagation()}
        >
          {hidden ? (
            <>
              <DropdownMenuItem asChild className="p-0">
                <Link
                  href={{ pathname: "/post/edit/[id]", params: { id } }}
                  className={ITEM}
                >
                  <Pencil size={16} />
                  {t("edit")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="p-0">
                <Link href="/premium-account" className={ITEM}>
                  <CircleArrowUp size={16} />
                  {t("upgradePlan")}
                </Link>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {!inactive && (
                <DropdownMenuItem asChild className="p-0">
                  <Link
                    // @ts-expect-error dynamic marketplace slug isn't in the routing pathnames
                    href={href}
                    className={ITEM}
                  >
                    <Eye size={16} />
                    {t("view")}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild className="p-0">
                <Link
                  href={{ pathname: "/post/edit/[id]", params: { id } }}
                  className={ITEM}
                >
                  <Pencil size={16} />
                  {t("edit")}
                </Link>
              </DropdownMenuItem>
              {/* A staff-inactive ad is not the owner's to republish any
                  more (2026-11-08): the backend answers
                  LISTING_INACTIVE_BY_STAFF and only staff can lift it, so the
                  row badge carries the reason and support is the next step. */}
              {!inactive && (
                <DropdownMenuItem
                  className={ITEM}
                  onSelect={() => {
                    setConfirm("renew");
                    setDialogOpen(true);
                  }}
                >
                  <RefreshCw size={16} />
                  {t("renew")}
                </DropdownMenuItem>
              )}
              {!inactive && (
                <DropdownMenuItem
                  className={ITEM}
                  onSelect={() => {
                    setShareOpen(true);
                  }}
                >
                  <Share2 size={16} />
                  {t("share")}
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuItem
            className={`${ITEM} text-destructive focus:text-destructive`}
            onSelect={() => {
              setConfirm("delete");
              setDialogOpen(true);
            }}
          >
            <Trash2 size={16} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* One confirm dialog serves renew/delete, with the wording swapped;
          `confirm` survives the close so the animation never falls back to the
          wrong label. */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>
              {confirm === "delete" ? t("deleteTitle") : t("renewTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirm === "delete" ? t("deleteBody") : t("renewBody")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={pending}
              onClick={() => setDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              className={
                confirm === "delete"
                  ? "cursor-pointer bg-red-600 text-white hover:bg-red-700"
                  : "cursor-pointer"
              }
              disabled={pending}
              onClick={() => void run()}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirm === "delete" ? t("delete") : t("renew")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share — the same copy-link dialog the feed cards use. */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{tShare("linkTitle")}</DialogTitle>
            <DialogDescription>{tShare("linkDescription")}</DialogDescription>
          </DialogHeader>
          <Input
            readOnly
            defaultValue={`${typeof window !== "undefined" ? window.location.origin : ""}${href}`}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
