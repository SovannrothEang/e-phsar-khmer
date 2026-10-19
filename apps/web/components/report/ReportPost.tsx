"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/i18n/routing";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/sonner";
import { createReport, loadReportReasons } from "@/actions/reports";
import { Post } from "@/lib/posts";

/** Real listings carry a UUID; mock cards carry a numeric id. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReportPostProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportPost({ post, open, onOpenChange }: ReportPostProps) {
  const router = useRouter();
  const [reasonId, setReasonId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: reasons = [], isLoading } = useQuery({
    queryKey: ["report-reasons", "listing"],
    queryFn: () => loadReportReasons("listing"),
    enabled: open,
    staleTime: 10 * 60_000,
  });

  // The dialog stays mounted (the parent owns `open`), so closing must clear
  // the form. Done in the close handler rather than an effect — every close
  // path (Cancel, Escape, overlay, submit) goes through this function.
  const reset = () => {
    setReasonId("");
    setDescription("");
    setSubmitting(false);
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = String(post.postId);
    if (!UUID_RE.test(targetId)) {
      toast.error("This listing cannot be reported right now.");
      return;
    }
    if (!reasonId) {
      toast.error("Choose a reason");
      return;
    }

    setSubmitting(true);
    const result = await createReport({
      targetType: "listing",
      targetId,
      reasonId,
      description: description.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.success) {
      if (result.status === 401) {
        toast.error("Sign in to report this listing");
        handleOpenChange(false);
        router.push("/login");
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success("Report submitted");
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-lg">
              Report {post?.title ? post.title.toUpperCase() : "Post"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Please provide details about why you are reporting this post.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <FieldGroup>
            <Field>
              <FieldLabel className="text-sm">
                Reason <span className="text-red-500">*</span>
              </FieldLabel>
              <Select value={reasonId} onValueChange={setReasonId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoading ? "Loading reasons…" : "Choose Reason"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {reasons.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.reason}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {!isLoading && reasons.length === 0 ? (
                <p className="text-xs text-destructive">
                  Could not load the report reasons. Please try again.
                </p>
              ) : null}
              <Field>
                <FieldLabel className="text-sm">Description</FieldLabel>
                <Textarea
                  id="message"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter your message..."
                  className="h-[140px] overflow-y-auto resize-none rounded-sm"
                />
              </Field>
            </Field>
          </FieldGroup>
          <DialogFooter className="flex flex-row justify-between">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="rounded-sm cursor-pointer h-10 text-foreground bg-muted-foreground/10 hover:bg-muted-foreground/20 w-1/3"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={submitting || !reasonId}
              className="rounded-sm cursor-pointer h-10 text-card bg-orange-400 hover:bg-orange-500 w-2/3 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
