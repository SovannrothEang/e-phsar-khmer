"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconChevronDown, IconX } from "@tabler/icons-react";

import { ResumeDobCalendar } from "@/components/profile/ResumeDobCalendar";
import { EDUCATION_LEVELS } from "@/components/profile/ResumePersonalDetailsDialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EducationEntry } from "@/components/profile/ResumePreview";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandItem, CommandList } from "@/components/ui/command";

/**
 * Resume builder — Step 4 of 8, "Educations".
 *
 * UI only for now: one education entry — School, Degree, Major, start / end
 * dates, "I currently attend here" and description — nothing saved. The Degree
 * picker reuses Step 1's education list; the dates reuse the DOB calendar, and
 * "I currently attend here" flips End Date to "Present" (value cleared).
 * "Next to Skills" validates like Step 3: allow the click, flag the missing
 * fields in red, scroll to the first one, then advance to Step 5; Skip advances
 * without validating.
 */
export function ResumeEducationsDialog({
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
  /** "wizard" = the guided flow; "edit" = the view's Add Education form. */
  mode?: "wizard" | "edit";
  onSave?: () => void;
  /** Pre-filled entry when opened via ⋮ → Edit; null for Add. */
  initial?: EducationEntry | null;
  /** Resolves `true` only once the entry was stored. */
  onSubmit: (entry: EducationEntry) => Promise<boolean>;
}) {
  const [school, setSchool] = useState("");
  const [degree, setDegree] = useState<string | undefined>(undefined);
  const [degreeOpen, setDegreeOpen] = useState(false);
  const [major, setMajor] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [current, setCurrent] = useState(false);
  const [description, setDescription] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const schoolFieldRef = useRef<HTMLDivElement>(null);
  const degreeFieldRef = useRef<HTMLDivElement>(null);
  const majorFieldRef = useRef<HTMLDivElement>(null);
  const startFieldRef = useRef<HTMLDivElement>(null);
  const endFieldRef = useRef<HTMLDivElement>(null);
  const draftId = useRef(crypto.randomUUID());

  // ⋮ → Edit loads that entry; Add loads blanks. Wizard mode keeps whatever is
  // on screen, so Back/Next never wipes a step in progress.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!open || mode !== "edit") return;
    setSchool(initial?.school ?? "");
    setDegree(initial?.degree ?? undefined);
    setMajor(initial?.major ?? "");
    setStartDate(initial?.startDate ?? null);
    setEndDate(initial?.endDate ?? null);
    setCurrent(initial?.current ?? false);
    setDescription(initial?.description ?? "");
    setShowErrors(false);
    draftId.current = initial?.id ?? crypto.randomUUID();
  }, [open, mode]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const from = new Date(new Date().getFullYear() - 100, 0, 1);
  const to = new Date();

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

  const schoolMissing = school.trim() === "";
  const degreeMissing = !degree;
  const majorMissing = major.trim() === "";
  const startMissing = startDate === null;
  const endMissing = !current && endDate === null;
  const dateOrderInvalid =
    !current &&
    startDate !== null &&
    endDate !== null &&
    endDate.getTime() < startDate.getTime();
  const valid =
    !schoolMissing &&
    !degreeMissing &&
    !majorMissing &&
    !startMissing &&
    !endMissing &&
    !dateOrderInvalid;
  const schoolError = showErrors && schoolMissing;
  const degreeError = showErrors && degreeMissing;
  const majorError = showErrors && majorMissing;
  const startError = showErrors && startMissing;
  const endError = showErrors && endMissing;
  const dateOrderError = showErrors && dateOrderInvalid;

  async function handleNext() {
    if (!valid) {
      setShowErrors(true);
      const firstMissing = schoolMissing
        ? schoolFieldRef
        : degreeMissing
          ? degreeFieldRef
          : majorMissing
            ? majorFieldRef
            : startMissing
              ? startFieldRef
              : endFieldRef;
      firstMissing.current?.scrollIntoView({ block: "center" });
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      id: draftId.current,
      school,
      degree: degree as string,
      major,
      startDate: startDate as Date,
      endDate,
      current,
      description,
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
              aria-label="Back to experiences"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
            >
              <IconArrowLeft size={20} />
            </button>
          )}
          <DialogTitle className="text-2xl font-semibold">
            {mode === "edit" ? "Add Education" : "Educations"}
          </DialogTitle>
          {mode === "wizard" ? (
            <span className="ml-auto text-lg font-semibold text-[#00a0e9]">
              Step 4 of 8
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
          Step 4 of 8 of the resume builder: education.
        </DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {mode === "wizard" && (
            <p className="text-base text-muted-foreground">
              Present your educational background to demonstrate the knowledge
              and value you bring to the role.
            </p>
          )}

          <FieldGroup className="mt-4">
            <Field ref={schoolFieldRef} data-invalid={schoolError}>
              <FieldLabel htmlFor="red-school">
                School <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="red-school"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                maxLength={100}
                aria-invalid={schoolError}
                className="h-11"
              />
              {schoolError && (
                <FieldError>{"Please enter the 'School'"}</FieldError>
              )}
            </Field>

            <Field ref={degreeFieldRef} data-invalid={degreeError}>
              <FieldLabel htmlFor="red-degree">
                Degree <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="relative">
                <Popover open={degreeOpen} onOpenChange={setDegreeOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      id="red-degree"
                      data-invalid={degreeError}
                      className="flex h-11 w-full cursor-pointer items-center rounded-sm border border-input bg-transparent px-2.5 pr-10 text-left text-base outline-none transition-colors focus-visible:border-[#00a0e9] focus-visible:ring-1 focus-visible:ring-[#00a0e9] data-[invalid=true]:border-destructive data-[invalid=true]:ring-3 data-[invalid=true]:ring-destructive/20 md:text-sm"
                    >
                      <span className={degree ? "" : "text-muted-foreground"}>
                        {degree ?? ""}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                  >
                    <Command>
                      <CommandList>
                        {EDUCATION_LEVELS.map((level) => (
                          <CommandItem
                            key={level}
                            value={level}
                            onSelect={() => {
                              setDegree(level);
                              setDegreeOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <span>{level}</span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {degree ? (
                  <button
                    type="button"
                    aria-label="Clear Degree"
                    onClick={() => setDegree(undefined)}
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
              {degreeError && (
                <FieldError>{"Please select 'Degree'"}</FieldError>
              )}
            </Field>

            <Field ref={majorFieldRef} data-invalid={majorError}>
              <FieldLabel htmlFor="red-major">
                Major <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="red-major"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                maxLength={100}
                aria-invalid={majorError}
                className="h-11"
              />
              {majorError && (
                <FieldError>{"Please enter the 'Major'"}</FieldError>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-5">
              <Field ref={startFieldRef} data-invalid={startError}>
                <FieldLabel htmlFor="red-start">
                  Start Date <span className="text-destructive">*</span>
                </FieldLabel>
                <div className="relative">
                  <Popover open={startOpen} onOpenChange={setStartOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        id="red-start"
                        data-invalid={startError}
                        className="flex h-11 w-full cursor-pointer items-center rounded-sm border border-input bg-transparent px-2.5 pr-10 text-left text-base outline-none transition-colors focus-visible:border-[#00a0e9] focus-visible:ring-1 focus-visible:ring-[#00a0e9] data-[invalid=true]:border-destructive data-[invalid=true]:ring-3 data-[invalid=true]:ring-destructive/20 md:text-sm"
                      >
                        <span
                          className={startDate ? "" : "text-muted-foreground"}
                        >
                          {startDate
                            ? formatDate(startDate)
                            : "Select Start Date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <ResumeDobCalendar
                        selected={startDate}
                        from={from}
                        to={to}
                        onSelect={(date) => {
                          setStartDate(date);
                          setStartOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {startDate && (
                    <button
                      type="button"
                      aria-label="Clear start date"
                      onClick={() => setStartDate(null)}
                      className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-muted hover:text-gray-700"
                    >
                      <IconX size={18} />
                    </button>
                  )}
                </div>
                {startError && (
                  <FieldError>{"Please select 'Start Date'"}</FieldError>
                )}
              </Field>

              <Field
                ref={endFieldRef}
                data-invalid={endError || dateOrderError}
              >
                <FieldLabel htmlFor="red-end">
                  End Date <span className="text-destructive">*</span>
                </FieldLabel>
                <div className="relative">
                  <Popover open={endOpen} onOpenChange={setEndOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        id="red-end"
                        disabled={current}
                        data-invalid={endError || dateOrderError}
                        className="flex h-11 w-full cursor-pointer items-center rounded-sm border border-input bg-transparent px-2.5 pr-10 text-left text-base outline-none transition-colors focus-visible:border-[#00a0e9] focus-visible:ring-1 focus-visible:ring-[#00a0e9] disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 data-[invalid=true]:border-destructive data-[invalid=true]:ring-3 data-[invalid=true]:ring-destructive/20 md:text-sm"
                      >
                        <span
                          className={
                            current || endDate ? "" : "text-muted-foreground"
                          }
                        >
                          {current
                            ? "Present"
                            : endDate
                              ? formatDate(endDate)
                              : "Select End Date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <ResumeDobCalendar
                        selected={endDate}
                        from={from}
                        to={to}
                        onSelect={(date) => {
                          setEndDate(date);
                          setEndOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {endDate && !current && (
                    <button
                      type="button"
                      aria-label="Clear end date"
                      onClick={() => setEndDate(null)}
                      className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-muted hover:text-gray-700"
                    >
                      <IconX size={18} />
                    </button>
                  )}
                </div>
                {endError && (
                  <FieldError>{"Please select 'End Date'"}</FieldError>
                )}
                {dateOrderError && (
                  <FieldError>
                    End date must be after the start date.
                  </FieldError>
                )}
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="red-current"
                checked={current}
                onCheckedChange={(checked) => {
                  setCurrent(checked);
                  if (checked) setEndDate(null);
                }}
                className="data-checked:bg-[#00a0e9]"
              />
              <label
                htmlFor="red-current"
                className="cursor-pointer text-base text-foreground"
              >
                I currently attend here
              </label>
            </div>

            <Field>
              <FieldLabel htmlFor="red-description">Description</FieldLabel>
              <Textarea
                id="red-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-[220px] resize-y"
              />
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
              Next to Skills
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
