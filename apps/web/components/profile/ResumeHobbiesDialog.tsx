"use client";

import { useEffect, useState } from "react";
import { IconArrowLeft, IconX } from "@tabler/icons-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * Resume builder — Step 7 of 8, "Hobbies & Interests".
 *
 * UI only: one free-text box — nothing is required here and nothing is saved.
 * "Next to References" advances to Step 8; Skip does the same — nothing here is
 * required.
 */
export function ResumeHobbiesDialog({
  open,
  onOpenChange,
  onBack,
  onNext,
  onSkip,
  mode = "wizard",
  onSave,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  /** "wizard" = the guided flow; "edit" = the view's Add Hobbies & Interests form. */
  mode?: "wizard" | "edit";
  onSave?: () => void;
  /** Pre-filled text when opened via ⋮ → Edit. */
  initial?: string | null;
  /** Resolves `true` only once the text was stored. */
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  // Opened via ⋮ → Edit: load the saved text (Add loads blank). Wizard mode
  // keeps whatever is on screen, so Back/Next never wipes a step in progress.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!open || mode !== "edit") return;
    setText(initial ?? "");
  }, [open, mode]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // Nothing here is required: both actions write the text, then advance.
  async function handleSubmit() {
    setSaving(true);
    const ok = await onSubmit(text);
    setSaving(false);
    if (!ok) return;
    if (mode === "edit") {
      onSave?.();
      return;
    }
    onNext();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[950px]"
      >
        <div className="flex shrink-0 items-center gap-3 border-b px-6 py-4">
          {mode === "wizard" && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to languages"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
            >
              <IconArrowLeft size={20} />
            </button>
          )}
          <DialogTitle className="text-2xl font-semibold">
            {mode === "edit"
              ? "Add Hobbies & Interests"
              : "Hobbies & Interests"}
          </DialogTitle>
          {mode === "wizard" ? (
            <span className="ml-auto text-lg font-semibold text-[#00a0e9]">
              Step 7 of 8
            </span>
          ) : (
            <DialogClose asChild>
              <button
                type="button"
                className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-gray-500 transition-colors hover:bg-muted"
              >
                <IconX size={18} />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          )}
        </div>
        <DialogDescription className="sr-only">
          Step 7 of 8 of the resume builder: hobbies and interests.
        </DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {mode === "wizard" && (
            <p className="text-base text-muted-foreground">
              Share what you enjoy doing to give employers a sense of your
              personality.
            </p>
          )}

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Hobbies and interests"
            maxLength={1000}
            className="mt-4 h-[440px] resize-y"
          />
        </div>

        {mode === "wizard" ? (
          <div className="flex shrink-0 gap-4 border-t px-6 py-4">
            <button
              type="button"
              onClick={onSkip}
              className="h-12 w-[165px] cursor-pointer rounded-sm bg-gray-500 text-base font-medium text-white transition-colors hover:bg-gray-600"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="h-12 flex-1 cursor-pointer rounded-sm bg-[#00a0e9] text-base font-medium text-white transition-colors hover:bg-[#00a0e9]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next to References
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-t px-6 py-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="h-12 w-full cursor-pointer rounded-sm bg-orange-500 text-base font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
