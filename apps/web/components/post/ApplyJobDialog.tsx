"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { applyToJob } from "@/actions/applications";

/** What the dialog's résumé card needs — see `getApplyResumeSummary`. */
export interface ApplyResumeSummary {
  hasResume: boolean;
  summary: string | null;
  cvFileName: string | null;
}

const NOTE_MAX = 2000;

/**
 * The apply form: an optional note, a card saying exactly what résumé will be
 * sent, and one submit.
 *
 * The résumé is not a choice — if the viewer has one it goes with the
 * application, because that is what a job application is. The card exists so
 * that is never a surprise, and it points at `/me/resume` when there is
 * nothing to send (applying without a résumé is allowed; the record simply
 * carries none).
 */
export function ApplyJobDialog({
  open,
  onOpenChange,
  listingId,
  listingTitle,
  resume,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  listingTitle: string;
  resume: ApplyResumeSummary | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (sending) return;
    setSending(true);
    const result = await applyToJob({ listingId, coverNote: note });
    setSending(false);

    if (!result.ok) {
      // 409 gets its own wording: it is the one rejection the applicant can
      // act on (they applied in another tab), and a generic toast would read
      // like a failure of the attempt that just happened.
      toast.error(
        result.code === "JOB_APPLICATION_EXISTS"
          ? "You already applied to this job"
          : result.message,
      );
      return;
    }

    toast.success("Application sent");
    onOpenChange(false);
    setNote("");
    // The button's state is server-rendered, so the new "Applied" face
    // arrives with a refresh rather than a local flag a reload would erase.
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply For This Job</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {listingTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="apply-note"
              className="text-sm font-medium text-foreground"
            >
              Message to the employer{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <Textarea
              id="apply-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder="Introduce yourself and say why you're a good fit."
              className="min-h-28"
            />
          </div>

          <div className="rounded-sm border bg-muted/40 p-3">
            <div className="flex items-start gap-2">
              <FileText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 text-sm">
                {resume?.hasResume ? (
                  <>
                    <p className="font-medium text-foreground">
                      Your résumé will be sent
                    </p>
                    {resume.summary ? (
                      <p className="text-muted-foreground line-clamp-2 mt-0.5">
                        {resume.summary}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground mt-0.5">
                      {resume.cvFileName
                        ? `CV: ${resume.cvFileName}`
                        : "No CV file attached — you can add one on your résumé page."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">
                      You haven&apos;t built a résumé yet
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      You can still apply — but employers see more when you send
                      one.
                    </p>
                  </>
                )}
                <Link
                  href="/me/resume"
                  className="text-[#00a0e9] hover:underline mt-1 inline-block"
                >
                  {resume?.hasResume
                    ? "Review your résumé"
                    : "Build your résumé"}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={sending}
            className="bg-[#f68b1e] hover:bg-[#e57a10] text-white cursor-pointer"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
