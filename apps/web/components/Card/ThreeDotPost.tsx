import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVertical, BookmarkIcon, } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "sonner";
import { Post } from "@/lib/posts";
import { getUserById } from "@/lib/data";
import { useState } from "react";
import { toSlug } from "@/lib/utils";
import { useRouter } from "@/i18n/routing";
import { ReportPost } from "../report/ReportPost";
import { IconShare3, IconUser, IconAlertTriangle } from '@tabler/icons-react';
import { Button } from "../ui/button";
import ShareModal from "@/components/share/ShareModel";

export function ThreeDotPost({ post }: { post: Post }) {

  const router = useRouter();
  const user = getUserById(post.userId);
  const [shareOpen, setShareOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button onClick={(e) => e.stopPropagation()} className="bg-card w-7 h-7  hover:bg-card/90 text-foreground rounded-full p-1.5 transition-colors shadow-sm outline-none cursor-pointer">
            <EllipsisVertical size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-40 rounded-lg p-1 shadow-lg border-muted"
        >
          <DropdownMenuItem>
            <button
              onClick={() => {
                if (user?.username) {
                  router.push({
                    pathname: "/[username]",
                    params: { username: user.username },
                  });
                }
              }}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer"
            >
              <IconUser className="scale-140" strokeWidth={1.5} />
              <span>View Profile</span>
            </button>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            onSelect={(e) => e.preventDefault()}
            className="p-0"
          >
            <Toggle
              pressed={isSaved}
              onPressedChange={(value) => {
                const willSave = value;
                toast.promise(
                  new Promise((resolve) =>
                    setTimeout(
                      () => resolve(willSave ? "Saved" : "Removed"),
                      1000,
                    ),
                  ),
                  {
                    loading: "Loading...",
                    success: (data) => `${data} successfully`,
                    error: "Error",
                    position: "top-right",
                  },
                );
                setIsSaved(willSave);
              }}
              className="flex w-full items-center justify-start gap-3 px-3 py-2 text-sm transition-colors data-[state=on]:text-blue-500 hover:bg-muted outline-none border-none rounded-none"
            >
              <BookmarkIcon
                size={18}
                className={`transition-all ${isSaved ? "fill-blue-500 text-blue-500" : "text-foreground"}`}
              />
              <span>{isSaved ? "Unsave" : "Save"}</span>
            </Toggle>
          </DropdownMenuItem>
          <DropdownMenuItem >
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer"
            >
              <IconShare3 className="scale-150" strokeWidth={1.5} />
              Share
            </button>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <button

              onClick={() => setReportOpen(true)}
              className="flex items-center  gap-3 px-3 py-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <IconAlertTriangle className="scale-130" />
              Report
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={`https://psakhmer.com/${toSlug(post.title)}-adid-${post.postId}`}
      />
      <ReportPost
        open={reportOpen}
        onOpenChange={setReportOpen}
        post={post}
      />
    </>
  )
}


