import { Button } from "../ui/button"
import { IconBookmark, IconAlertTriangle, IconShare3 } from '@tabler/icons-react';
import { useState } from "react";
import ShareModal from "../share/ShareModel";
import { Post } from "@/lib/posts";
import { toSlug } from "@/lib/utils";
import { ReportPost } from "../report/ReportPost";
export function ThreeButton({ post }: { post: Post }) {
    const [shareOpen, setShareOpen] = useState(false)
    const [reportOpen, setReportOpen] = useState(false)
    return (
        <>
            <div className="flex gap-2 mt-4">
                <Button className="flex-1 bg-muted-foreground/10 hover:bg-muted-foreground/20 h-11 rounded-sm text-base flex justify-center items-center text-foreground transition-colors cursor-pointer">
                    <IconBookmark className="scale-150 mr-2 text-foreground" strokeWidth={1.5} /> Save
                </Button>
                <Button onClick={() => setReportOpen(true)} className="flex-1 bg-muted-foreground/10 hover:bg-muted-foreground/20 h-11 rounded-sm text-base flex justify-center items-center text-foreground transition-colors cursor-pointer text-destructive focus:text-destructive">
                    <IconAlertTriangle className="scale-150 mr-2 text-destructive focus:text-destructive" strokeWidth={1.5} /> Report
                </Button>
                <Button
                    onClick={() => setShareOpen(true)}
                    className="flex-1 bg-muted-foreground/10 hover:bg-muted-foreground/20 h-11 rounded-sm text-base flex justify-center items-center text-foreground transition-colors cursor-pointer">
                    <IconShare3 className="scale-150 mr-2 text-foreground" stroke={1.5} /> Share
                </Button>
            </div>
            <ReportPost 
                open={reportOpen}
                onOpenChange={setReportOpen}
                post={post}
            />
            <ShareModal
                open={shareOpen}
                onOpenChange={setShareOpen}
                url={`https://psakhmer.com/${toSlug(post.title)}-adid-${post.postId}`}
            /> 
        </>
    )
}