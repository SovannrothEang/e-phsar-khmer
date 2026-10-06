"use client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import {
  IconBellFilled,
  IconMessageFilled,
  IconFolderOpen,
  IconHeart,
  IconBookmark,
  IconBriefcase,
  IconClipboardList,
  IconId,
  IconCreditCard,
  IconSettings,
} from "@tabler/icons-react";
import { FaCamera } from "react-icons/fa";
import { ChartNoAxesCombined, ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";
import { userLogout } from "@/actions/logout";
import { useQueryClient } from "@tanstack/react-query";
import { markSignedOut } from "./SessionCacheGuard";

/** The one layout every account-menu entry shares. */
const ITEM =
  "flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none";

interface SocialBarUser {
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePhotoUrl?: string | null;
  profileImage?: string;
}

export function SocialBar({ user }: { user: SocialBarUser }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    "My Account";
  const handle = user.username ? `@${user.username}` : "";
  const avatarUrl =
    user.profilePhotoUrl ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00a0e9&color=fff`;
  return (
    <div className="flex items-center gap-3">
      {/* Notifications */}
      <Button
        variant={"ghost"}
        onClick={() => router.push("/notifications")}
        className="relative bg-card rounded-full h-10 w-10 border border-muted-foreground/50 text-muted-foreground hover:text-gray-700 transition-colors cursor-pointer"
      >
        <IconBellFilled className="scale-150 " />
        {/* <span className="absolute top-0 right-0 flex h-[10px] w-[10px] items-center justify-center rounded-full bg-[#f04d4e] text-[10px] font-bold text-white border-2 border-white">
                    4
                </span> */}
      </Button>
      {/* Messages */}
      <Button
        variant={"ghost"}
        onClick={() => router.push("/chats")}
        className="relative bg-card rounded-full h-10 w-10 border border-muted-foreground/50 text-muted-foreground hover:text-gray-700 transition-colors cursor-pointer"
      >
        <IconMessageFilled className="scale-150" />
        <ChatUnreadBadge />
      </Button>
      {/* User Dropdown */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger className="outline-none ml-2">
          <div className="relative h-10 w-10 cursor-pointer">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-muted-foreground/50">
              <Image
                src={avatarUrl}
                width={36}
                height={36}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Dropdown affordance: small chevron badge on the avatar corner */}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card border border-muted-foreground/30 shadow-sm">
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-[280px] p-0 shadow-xl rounded-md border border-muted-foreground/20 shadow-md mt-2 "
        >
          <div className="py-2">
            <DropdownMenuItem
              onClick={() => router.push("/me")}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
            >
              <div className="flex items-center gap-3 rounded-t-md">
                <div className="h-12 w-12 rounded-full overflow-hidden border border-[#00a0e9] flex-shrink-0">
                  <Image
                    src={avatarUrl}
                    width={50}
                    height={50}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-medium text-[#00a0e9]">
                    {displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {handle}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Every item is a real link — `asChild` puts the item's own
                (already merged) classes on the anchor, so a middle-click or a
                copied address works and these are not buttons pretending to
                navigate. They were all inert before: no href, no onClick. */}
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/me">
                <IconFolderOpen
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-sm text-foreground font-medium">
                  My Ads
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/me/likes">
                <IconHeart
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-sm text-foreground font-medium">
                  Likes
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/me/saved">
                <IconBookmark
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-sm text-foreground font-medium">
                  Saved
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/me/applied-jobs">
                <IconBriefcase
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-sm text-foreground font-medium">
                  Applied Jobs
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/me/job-applications">
                <IconClipboardList
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-sm text-foreground font-medium">
                  Job Applications
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/me/resume">
                <IconId
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-sm text-foreground font-medium">
                  Resume (CV)
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/me/subscriptions">
                <IconCreditCard
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-sm text-foreground font-medium">
                  Subscriptions
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/insight">
                <ChartNoAxesCombined
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-[14px] text-foreground font-medium">
                  Insight
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/settings">
                <IconSettings
                  className="scale-150 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-[14px] text-foreground font-medium">
                  Settings
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                // Drop the previous account's cached chat data + E2E engine
                // before the redirect, so neither the next visitor nor the
                // next login ever sees it (see SessionCacheGuard).
                markSignedOut(queryClient);
                void userLogout();
              }}
              className="flex items-center gap-3 px-5 py-2.5 cursor-pointer text-gray-700 hover:bg-gray-50 outline-none"
            >
              <LogOut
                className="scale-150 text-muted-foreground"
                strokeWidth={1.5}
              />
              <span className="text-sm text-foreground font-medium">
                Sign out
              </span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        asChild
        variant="ghost"
        className="h-[42px] bg-[#f68b1e] text-white px-6 text-base font-medium rounded transition-colors hover:bg-[#f68b1e]/80 hover:text-white"
      >
        <Link href={`/post`}>
          <FaCamera className="scale-120" strokeWidth={2.5} />
          Sell
        </Link>
      </Button>
    </div>
  );
}
