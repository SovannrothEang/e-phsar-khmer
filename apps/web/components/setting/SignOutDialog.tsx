"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { userLogout } from "@/actions/logout";

/**
 * The sign-out confirmation, shared by the settings hub and the left rail —
 * only the trigger's styling differs, so the caller brings it.
 *
 * The original markup POSTed a form at "/" and never ended the session; this
 * calls the same `userLogout()` the navbar uses (clears both user cookies,
 * then redirects locale-aware to /login).
 */
export function SignOutDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[600px] rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Sign Out</DialogTitle>
          <DialogDescription className="mt-2 text-base text-muted-foreground">
            Are you sure that you want to sign out from your account?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-row gap-2 mt-4">
          <DialogClose asChild>
            <Button
              variant="ghost"
              className="flex-1 border border-border hover:bg-card cursor-pointer"
            >
              Cancel
            </Button>
          </DialogClose>

          <Button
            onClick={() => void userLogout()}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium cursor-pointer"
          >
            Sign Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
