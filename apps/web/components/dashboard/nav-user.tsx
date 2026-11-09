"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, LogOut, Users } from "lucide-react";
import type { CurrentUser } from "@/actions/user";
import { adminLogout } from "@/actions/logout";

export function NavUser({ user }: { user: CurrentUser | null }) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [confirmLogout, setConfirmLogout] = useState(false);
  if (!user) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar size="lg">
              <AvatarImage src={user.profileImage} alt={user.username} />
              <AvatarFallback>
                {user.username ? user.username[0].toUpperCase() : "U"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" sideOffset={12} align="end">
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left type-body-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.profileImage} alt={user.username} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left type-body-sm">
                <span className="truncate font-medium">{user.username}</span>
                <span className="truncate type-meta text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <Users className="mr-2 size-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/wanderer/dashboard/notifications")}
            >
              <Bell className="mr-2 size-4" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem>
              {/* <Roles className="mr-2 size-4" /> */}
              Role:{" "}
              <div className="ml-1 rounded-lg px-2 py-0.5 bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100">
                {user.role}
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setConfirmLogout(true)}
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out?</DialogTitle>
            <DialogDescription>
              You will need to sign in again to access the dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-sm cursor-pointer"
              onClick={() => setConfirmLogout(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9 rounded-sm cursor-pointer bg-red-500 text-white hover:bg-red-600 hover:text-white"
              onClick={() => startTransition(() => void adminLogout())}
            >
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
