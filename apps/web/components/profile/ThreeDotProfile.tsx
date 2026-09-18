"use client";

import {
  AlertTriangleIcon,
  CopyIcon,
  ShareIcon,
  VolumeOffIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EllipsisVertical } from "lucide-react";
import { useState } from "react";
import { ReportAccount } from "@/components/report/ReportAccount";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User } from "@/lib/user";

export function ThreeDotProfile({ user }: { user: User }) {
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full border-muted-foreground/30 text-muted-foreground h-9 w-9"
          >
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <VolumeOffIcon />
              Save
            </DropdownMenuItem>
            <DropdownMenuItem>
              <ShareIcon />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CopyIcon />
              Copy Link
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="text-red-500">
              <AlertTriangleIcon />
              <Button
                variant="ghost"
                onClick={() => setReportOpen(true)}
                className="text-red-500 cursor-pointer "
              >
                Report
              </Button>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportAccount
        open={reportOpen}
        onOpenChange={setReportOpen}
        user={user}
      />
    </>
  );
}
