"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconChevronDown, IconX } from "@tabler/icons-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SkillEntry } from "@/components/profile/ResumePreview";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandItem, CommandList } from "@/components/ui/command";

/**
 * Resume builder — Step 5 of 8, "Skills".
 *
 * UI only for now: one skill entry — Title* and Level* (Basic / Intermediate /
 * Advanced / Expert) — nothing saved. "Next to Languages" validates like Steps
 * 3–4: allow the click, flag the missing fields in red, scroll to the first
 * one, then advance to Step 6; Skip advances without validating.
 */

const LEVELS = ["Basic", "Intermediate", "Advanced", "Expert"] as const;

export function ResumeSkillsDialog({
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
  /** "wizard" = the guided flow; "edit" = the view's Add Skill form. */
  mode?: "wizard" | "edit";
  onSave?: () => void;
  /** Pre-filled entry when opened via ⋮ → Edit; null for Add. */
  initial?: SkillEntry | null;
  /** Resolves `true` only once the entry was stored. */
  onSubmit: (entry: SkillEntry) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<string | undefined>(undefined);
  const [levelOpen, setLevelOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleFieldRef = useRef<HTMLDivElement>(null);
  const levelFieldRef = useRef<HTMLDivElement>(null);
  const draftId = useRef(crypto.randomUUID());

  // ⋮ → Edit loads that entry; Add loads blanks. Wizard mode keeps whatever is
  // on screen, so Back/Next never wipes a step in progress.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!open || mode !== "edit") return;
    setTitle(initial?.title ?? "");
    setLevel(initial?.level ?? undefined);
    setShowErrors(false);
    draftId.current = initial?.id ?? crypto.randomUUID();
  }, [open, mode]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const titleMissing = title.trim() === "";
  const levelMissing = !level;
  const valid = !titleMissing && !levelMissing;
  const titleError = showErrors && titleMissing;
  const levelError = showErrors && levelMissing;

  async function handleNext() {
    if (!valid) {
      setShowErrors(true);
      const firstMissing = titleMissing ? titleFieldRef : levelFieldRef;
      firstMissing.current?.scrollIntoView({ block: "center" });
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      id: draftId.current,
      title,
      level: level as string,
    });
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
              aria-label="Back to educations"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
            >
              <IconArrowLeft size={20} />
            </button>
          )}
          <DialogTitle className="text-2xl font-semibold">
            {mode === "edit" ? "Add Skill" : "Skills"}
          </DialogTitle>
          {mode === "wizard" ? (
            <span className="ml-auto text-lg font-semibold text-[#00a0e9]">
              Step 5 of 8
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
          Step 5 of 8 of the resume builder: skills.
        </DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {mode === "wizard" && (
            <p className="text-base text-muted-foreground">
              List the skills that best represent your strengths and help you
              stand out from other candidates.
            </p>
          )}

          <FieldGroup className="mt-4">
            <Field ref={titleFieldRef} data-invalid={titleError}>
              <FieldLabel htmlFor="rsk-title">
                Title <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="rsk-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
                aria-invalid={titleError}
                className="h-11"
              />
              {titleError && (
                <FieldError>{"Please enter the 'Title'"}</FieldError>
              )}
            </Field>

            <Field ref={levelFieldRef} data-invalid={levelError}>
              <FieldLabel htmlFor="rsk-level">
                Level <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="relative">
                <Popover open={levelOpen} onOpenChange={setLevelOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      id="rsk-level"
                      data-invalid={levelError}
                      className="flex h-11 w-full cursor-pointer items-center rounded-sm border border-input bg-transparent px-2.5 pr-10 text-left text-base outline-none transition-colors focus-visible:border-[#00a0e9] focus-visible:ring-1 focus-visible:ring-[#00a0e9] data-[invalid=true]:border-destructive data-[invalid=true]:ring-3 data-[invalid=true]:ring-destructive/20 md:text-sm"
                    >
                      <span className={level ? "" : "text-muted-foreground"}>
                        {level ?? ""}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                  >
                    <Command>
                      <CommandList>
                        {LEVELS.map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            onSelect={() => {
                              setLevel(option);
                              setLevelOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <span>{option}</span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {level ? (
                  <button
                    type="button"
                    aria-label="Clear Level"
                    onClick={() => setLevel(undefined)}
                    className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-muted hover:text-gray-700"
                  >
                    <IconX size={18} />
                  </button>
                ) : (
                  <IconChevronDown
                    size={16}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500"
                  />
                )}
              </div>
              {levelError && <FieldError>{"Please select 'Level'"}</FieldError>}
            </Field>
          </FieldGroup>
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
              onClick={handleNext}
              disabled={saving}
              className="h-12 flex-1 cursor-pointer rounded-sm bg-[#00a0e9] text-base font-medium text-white transition-colors hover:bg-[#00a0e9]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next to Languages
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-t px-6 py-4">
            <button
              type="button"
              onClick={handleNext}
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
