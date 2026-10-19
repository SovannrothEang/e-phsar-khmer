"use client";

import { useEffect, useRef, useState } from "react";
import type { ResumePersonalData } from "@/components/profile/ResumePreview";
import {
  isValidEmail,
  isValidPhone,
  isValidPhotoFile,
  isValidYearsOfExperience,
} from "@/components/profile/resume-validation";
import { deleteUploadedUser, signUploadUser } from "@/actions/files";
import { toast } from "@/components/ui/sonner";
import Image from "next/image";
import {
  IconChevronDown,
  IconMinus,
  IconPencil,
  IconPlus,
  IconUser,
  IconX,
} from "@tabler/icons-react";

import {
  EMPTY_RESUME_LOCATION,
  ResumeLocationDialog,
  resumeLocationLabel,
  type ResumeLocation,
} from "@/components/profile/ResumeLocationDialog";
import { ResumeDobCalendar } from "@/components/profile/ResumeDobCalendar";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Resume builder — Step 1 of 8, "Add Personal Details".
 *
 * First/last name prefill from the account, the photo uploads to storage on
 * pick (`resume/{userId}/…`, validated as an image ≤ 5 MB before anything is
 * signed), phone rows can be added, Location opens the project's province →
 * district → commune popup, and Education Level is a fixed list. Clicking
 * "Next to summary" with First Name, Last Name or Phone Number missing flags
 * those fields in red and scrolls the first one into view (the captain's call:
 * allow the click, then alert); a fully valid form is written through to the
 * API first and only then advances to Step 2 (Career Summary) — a failed save
 * leaves the form open, data intact.
 */

const GENDERS = ["Male", "Female"] as const;
const MAX_PHONES = 3;
const MARITAL_STATUSES = ["Single", "Married", "Divorced"] as const;
export const EDUCATION_LEVELS = [
  "High School",
  "Associate",
  "Professional",
  "Bachelor's Degree",
  "Master",
  "Doctor",
] as const;

/** Label prefixes for the view's "add this field" chip targets. */
const FOCUS_LABELS: Record<string, string> = {
  gender: "Gender",
  dob: "Date Of Birth",
  nationality: "Nationality",
  email: "Email",
  location: "Location",
  address: "Address",
  marital: "Marital Status",
  education: "Education Level",
  position: "Current Position",
  experience: "Years of Experience",
};

/** A wide bordered choice button (Gender / Marital Status). */
function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 flex-1 cursor-pointer rounded-sm border text-base transition-colors",
        selected
          ? "border-[#00a0e9] bg-[#00a0e9]/5 text-[#00a0e9]"
          : "border-input hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  );
}

export function ResumePersonalDetailsDialog({
  open,
  onOpenChange,
  defaultFirstName,
  defaultLastName,
  onNext,
  mode = "wizard",
  onSave,
  focusField,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFirstName: string;
  defaultLastName: string;
  onNext: () => void;
  /** "wizard" = Step 1 of the guided flow; "edit" = the view's Edit Personal Details form. */
  mode?: "wizard" | "edit";
  onSave?: () => void;
  /** The view's chip target: scroll the edit form to this field, highlight its label and focus its control. */
  focusField?: string | null;
  /** The stored block when opened via the view; null for a fresh wizard run. */
  initial?: ResumePersonalData | null;
  /** Resolves `true` only once the block was stored. */
  onSubmit: (data: ResumePersonalData) => Promise<boolean>;
}) {
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [gender, setGender] = useState<string | null>(null);
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null);
  const [phones, setPhones] = useState<string[]>([""]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dob, setDob] = useState<Date | null>(null);
  const [dobOpen, setDobOpen] = useState(false);
  const [education, setEducation] = useState<string | undefined>(undefined);
  const [educationOpen, setEducationOpen] = useState(false);
  const [place, setPlace] = useState<ResumeLocation>(EMPTY_RESUME_LOCATION);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSession, setLocationSession] = useState(0);
  const [nationality, setNationality] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [position, setPosition] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const firstNameFieldRef = useRef<HTMLDivElement>(null);
  const lastNameFieldRef = useRef<HTMLDivElement>(null);
  const phoneFieldRef = useRef<HTMLDivElement>(null);
  const emailFieldRef = useRef<HTMLDivElement>(null);
  const yoeFieldRef = useRef<HTMLDivElement>(null);
  /** An object uploaded this session but not yet part of a stored block. */
  const pendingPhoto = useRef<{ url: string; path: string } | null>(null);

  // Opened via the view's Edit paths: load the stored block (the wizard keeps
  // whatever is on screen, so Back/Next never wipes a step in progress).
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!open || mode !== "edit") return;
    setFirstName(initial?.firstName ?? defaultFirstName);
    setLastName(initial?.lastName ?? defaultLastName);
    setGender(initial?.gender ?? null);
    setMaritalStatus(initial?.maritalStatus ?? null);
    setPhones(initial?.phones.length ? initial.phones : [""]);
    setPhoto(initial?.photo ?? null);
    setDob(initial?.dob ?? null);
    setEducation(initial?.education);
    setPlace(initial?.place ?? EMPTY_RESUME_LOCATION);
    setNationality(initial?.nationality ?? "");
    setEmail(initial?.email ?? "");
    setAddress(initial?.address ?? "");
    setPosition(initial?.position ?? "");
    setYearsOfExperience(initial?.yearsOfExperience ?? "");
    setShowErrors(false);
  }, [open, mode]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  /**
   * Upload on pick (the post form's `ImageUpload` recipe): reject a non-image
   * or an oversized file before anything is signed, then sign → PUT the bytes
   * → hold the public URL. The object stays out of the saved document until a
   * successful submit, so a replacement or an abandoned dialog can remove it.
   */
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isValidPhotoFile(file)) {
      toast.error("Choose an image up to 5MB.");
      return;
    }

    setPhotoUploading(true);
    const signed = await signUploadUser(file.name, "resume");
    if (!signed.success) {
      setPhotoUploading(false);
      toast.error(signed.error);
      return;
    }
    const uploaded = await fetch(signed.data.signedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    }).catch(() => null);
    setPhotoUploading(false);
    if (!uploaded?.ok) {
      toast.error("Couldn't upload your photo. Please try again.");
      return;
    }

    // A second pick replaces the previous unsaved object outright.
    const previous = pendingPhoto.current;
    pendingPhoto.current = {
      url: signed.data.publicUrl,
      path: signed.data.path,
    };
    if (previous) void deleteUploadedUser([previous.path]);
    setPhoto(signed.data.publicUrl);
  }

  /**
   * Closing without a successful submit abandons the upload: remove the
   * object (best effort — a failure is logged, never surfaced) and go back to
   * the last stored photo.
   */
  function handleOpenChange(next: boolean) {
    if (!next && pendingPhoto.current) {
      void deleteUploadedUser([pendingPhoto.current.path]);
      pendingPhoto.current = null;
      setPhoto(initial?.photo ?? null);
    }
    onOpenChange(next);
  }

  function updatePhone(index: number, value: string) {
    setPhones((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPhone() {
    setPhones((prev) => (prev.length >= MAX_PHONES ? prev : [...prev, ""]));
  }

  function removePhone(index: number) {
    setPhones((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  const firstNameMissing = firstName.trim() === "";
  const lastNameMissing = lastName.trim() === "";
  const phoneMissing = !phones.some((phone) => phone.trim() !== "");
  const phoneFormatInvalid = phones.some(
    (phone) => phone.trim() !== "" && !isValidPhone(phone),
  );
  const emailInvalid = email.trim() !== "" && !isValidEmail(email);
  const yoeInvalid =
    yearsOfExperience.trim() !== "" &&
    !isValidYearsOfExperience(yearsOfExperience);
  const valid =
    !firstNameMissing &&
    !lastNameMissing &&
    !phoneMissing &&
    !phoneFormatInvalid &&
    !emailInvalid &&
    !yoeInvalid;
  const firstNameError = showErrors && firstNameMissing;
  const lastNameError = showErrors && lastNameMissing;
  const phoneError = showErrors && phoneMissing;
  const phoneFormatError = showErrors && phoneFormatInvalid;
  const emailError = showErrors && emailInvalid;
  const yoeError = showErrors && yoeInvalid;

  async function handleNext() {
    if (!valid) {
      setShowErrors(true);
      const firstMissing = firstNameMissing
        ? firstNameFieldRef
        : lastNameMissing
          ? lastNameFieldRef
          : phoneMissing || phoneFormatInvalid
            ? phoneFieldRef
            : emailInvalid
              ? emailFieldRef
              : yoeFieldRef;
      firstMissing.current?.scrollIntoView({ block: "center" });
      return;
    }
    setSaving(true);
    const ok = await onSubmit({
      firstName,
      lastName,
      gender,
      dob,
      nationality,
      email,
      education,
      maritalStatus,
      place,
      address,
      position,
      yearsOfExperience,
      phones,
      photo,
    });
    setSaving(false);
    if (!ok) return;
    // The uploaded photo now belongs to the stored block — closing must not
    // clean it up any more.
    pendingPhoto.current = null;
    if (mode === "edit") {
      onSave?.();
      return;
    }
    onNext();
  }

  /**
   * The view's "add this field" chips land here: scroll the edit form to the
   * field, tint its label amber and focus its control so the user can type
   * straight away. Imperative one-shot highlight, cleaned up on close.
   */
  useEffect(() => {
    if (mode !== "edit" || !open || !focusField) return;
    let undo: (() => void) | undefined;
    let tries = 0;
    let raf = 0;
    const attempt = () => {
      tries += 1;
      // Radix mounts the dialog's portal a frame after `open` flips — retry
      // briefly until the content (and the target field) exists.
      const dlg = document.querySelector('[role="dialog"]');
      if (focusField === "photo") {
        dlg?.querySelector(".overflow-y-auto")?.scrollTo({ top: 0 });
        return;
      }
      const wanted = FOCUS_LABELS[focusField];
      const fields = [
        ...(dlg?.querySelectorAll<HTMLElement>('[data-slot="field"]') ?? []),
      ];
      const field = wanted
        ? fields.find((f) =>
            f
              .querySelector('[data-slot="field-label"]')
              ?.textContent?.trim()
              .startsWith(wanted),
          )
        : undefined;
      if (!field) {
        if (tries < 20) raf = requestAnimationFrame(attempt);
        return;
      }
      field.scrollIntoView({ block: "center" });
      const label = field.querySelector<HTMLElement>(
        '[data-slot="field-label"]',
      );
      const control = field.querySelector<HTMLElement>(
        "input, textarea, button",
      );
      label?.classList.add("text-amber-500");
      if (control) {
        control.style.borderColor = "#00a0e9";
        control.style.boxShadow = "0 0 0 1px #00a0e9";
      }
      control?.focus({ preventScroll: true });
      // The Date Of Birth chip lands with the calendar already open — the
      // captain's rule: no second click to see the picker.
      if (focusField === "dob") setDobOpen(true);
      undo = () => {
        label?.classList.remove("text-amber-500");
        if (control) {
          control.style.borderColor = "";
          control.style.boxShadow = "";
        }
        setDobOpen(false);
      };
    };
    raf = requestAnimationFrame(attempt);
    return () => {
      cancelAnimationFrame(raf);
      undo?.();
    };
  }, [open, mode, focusField]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[950px]"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <DialogTitle className="text-2xl font-semibold">
            {mode === "edit" ? "Edit Personal Details" : "Add Personal Details"}
          </DialogTitle>
          <div className="flex items-center gap-4">
            {mode === "wizard" && (
              <span className="text-lg font-semibold text-[#00a0e9]">
                Step 1 of 8
              </span>
            )}
            <DialogClose asChild>
              <button
                type="button"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-gray-500 transition-colors hover:bg-muted"
              >
                <IconX size={18} />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
        </div>
        <DialogDescription className="sr-only">
          Step 1 of 8 of the resume builder: personal details.
        </DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <FieldGroup>
            <div className="flex flex-col gap-5 sm:flex-row">
              {/* Photo (3 x 4) — the empty frame stands in while an upload
                  is in flight, so a half-state is never shown. */}
              <div className="relative h-[215px] w-[190px] shrink-0 overflow-hidden rounded-sm border">
                {photo && !photoUploading ? (
                  <Image
                    src={photo}
                    alt="Resume photo"
                    width={188}
                    height={213}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <IconUser
                      size={64}
                      strokeWidth={1.5}
                      className="text-gray-400"
                    />
                    <span className="text-base text-gray-500">3 x 4</span>
                  </div>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute right-2 bottom-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border bg-muted text-gray-600 transition-colors hover:bg-muted/70"
                >
                  <IconPencil size={14} />
                  <span className="sr-only">Upload photo</span>
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-5">
                <Field ref={firstNameFieldRef} data-invalid={firstNameError}>
                  <FieldLabel htmlFor="rpd-first-name">
                    First Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="rpd-first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={50}
                    aria-invalid={firstNameError}
                    className="h-11"
                  />
                  {firstNameError && (
                    <FieldError>{"Please enter the 'First Name'"}</FieldError>
                  )}
                </Field>
                <Field ref={lastNameFieldRef} data-invalid={lastNameError}>
                  <FieldLabel htmlFor="rpd-last-name">
                    Last Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="rpd-last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={50}
                    aria-invalid={lastNameError}
                    className="h-11"
                  />
                  {lastNameError && (
                    <FieldError>{"Please enter the 'Last Name'"}</FieldError>
                  )}
                </Field>
              </div>
            </div>

            <Field>
              <FieldLabel>Gender</FieldLabel>
              <div className="flex gap-5">
                {GENDERS.map((option) => (
                  <ChoiceButton
                    key={option}
                    selected={gender === option}
                    onClick={() => setGender(option)}
                  >
                    {option}
                  </ChoiceButton>
                ))}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="rpd-dob">Date Of Birth</FieldLabel>
              <div className="relative">
                <Popover open={dobOpen} onOpenChange={setDobOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      id="rpd-dob"
                      className="flex h-11 w-full cursor-pointer items-center rounded-sm border border-input bg-transparent px-2.5 pr-10 text-left text-base outline-none transition-colors focus-visible:border-[#00a0e9] focus-visible:ring-1 focus-visible:ring-[#00a0e9] md:text-sm"
                    >
                      {dob
                        ? dob.toLocaleDateString("en-US", {
                            month: "short",
                            day: "2-digit",
                            year: "numeric",
                          })
                        : ""}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <ResumeDobCalendar
                      selected={dob}
                      from={new Date(new Date().getFullYear() - 100, 0, 1)}
                      to={new Date()}
                      onSelect={(date) => {
                        setDob(date);
                        setDobOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {dob && (
                  <button
                    type="button"
                    aria-label="Clear date of birth"
                    onClick={() => setDob(null)}
                    className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-muted hover:text-gray-700"
                  >
                    <IconX size={18} />
                  </button>
                )}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="rpd-nationality">Nationality</FieldLabel>
              <Input
                id="rpd-nationality"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                maxLength={50}
                className="h-11"
              />
            </Field>

            <Field ref={emailFieldRef} data-invalid={emailError}>
              <FieldLabel htmlFor="rpd-email">Email</FieldLabel>
              <Input
                id="rpd-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                aria-invalid={emailError}
                className="h-11"
              />
              {emailError && (
                <FieldError>Please enter a valid email address.</FieldError>
              )}
            </Field>

            <Field
              ref={phoneFieldRef}
              data-invalid={phoneError || phoneFormatError}
            >
              <FieldLabel>
                Phone Number <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="flex flex-col gap-3">
                {phones.map((phone, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Input
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => updatePhone(index, e.target.value)}
                        placeholder={`Phone Number ${index + 1}`}
                        maxLength={15}
                        aria-invalid={
                          (phoneError && index === 0) ||
                          (showErrors &&
                            phone.trim() !== "" &&
                            !isValidPhone(phone))
                        }
                        className="h-11 pr-11"
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          aria-label={`Remove phone number ${index + 1}`}
                          onClick={() => removePhone(index)}
                          className="absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                        >
                          <IconMinus size={16} />
                        </button>
                      )}
                    </div>
                    {index === phones.length - 1 &&
                      phones.length < MAX_PHONES && (
                        <button
                          type="button"
                          aria-label="Add another phone number"
                          onClick={addPhone}
                          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#00a0e9] text-white transition-colors hover:bg-[#00a0e9]/90"
                        >
                          <IconPlus size={18} />
                        </button>
                      )}
                  </div>
                ))}
              </div>
              {phoneError && (
                <FieldError>At least one phone number is required.</FieldError>
              )}
              {phoneFormatError && (
                <FieldError>Please enter a valid phone number.</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel>Location</FieldLabel>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setLocationSession((session) => session + 1);
                    setLocationOpen(true);
                  }}
                  className="flex h-11 w-full cursor-pointer items-center rounded-sm border border-input bg-transparent px-2.5 pr-10 text-left text-base outline-none transition-colors focus-visible:border-[#00a0e9] focus-visible:ring-1 focus-visible:ring-[#00a0e9] md:text-sm"
                >
                  <span
                    className={place.province ? "" : "text-muted-foreground"}
                  >
                    {resumeLocationLabel(place) || "Choose Location"}
                  </span>
                </button>
                {place.province ? (
                  <button
                    type="button"
                    aria-label="Clear location"
                    onClick={() => setPlace(EMPTY_RESUME_LOCATION)}
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
              <ResumeLocationDialog
                key={locationSession}
                open={locationOpen}
                onOpenChange={setLocationOpen}
                value={place}
                onChange={setPlace}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="rpd-address">Address</FieldLabel>
              <Input
                id="rpd-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={200}
                className="h-11"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="rpd-education">Education Level</FieldLabel>
              <div className="relative">
                <Popover open={educationOpen} onOpenChange={setEducationOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      id="rpd-education"
                      className="flex h-11 w-full cursor-pointer items-center rounded-sm border border-input bg-transparent px-2.5 pr-10 text-left text-base outline-none transition-colors focus-visible:border-[#00a0e9] focus-visible:ring-1 focus-visible:ring-[#00a0e9] md:text-sm"
                    >
                      <span
                        className={education ? "" : "text-muted-foreground"}
                      >
                        {education ?? ""}
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
                              setEducation(level);
                              setEducationOpen(false);
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
                {education ? (
                  <button
                    type="button"
                    aria-label="Clear Education Level"
                    onClick={() => setEducation(undefined)}
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
            </Field>

            <Field>
              <FieldLabel htmlFor="rpd-position">Current Position</FieldLabel>
              <Input
                id="rpd-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                maxLength={100}
                className="h-11"
              />
            </Field>

            <Field ref={yoeFieldRef} data-invalid={yoeError}>
              <FieldLabel htmlFor="rpd-experience">
                Years of Experience
              </FieldLabel>
              <Input
                id="rpd-experience"
                inputMode="numeric"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                maxLength={3}
                aria-invalid={yoeError}
                className="h-11"
              />
              {yoeError && (
                <FieldError>
                  Please enter a realistic number of years (0–60).
                </FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel>Marital Status</FieldLabel>
              <div className="flex gap-5">
                {MARITAL_STATUSES.map((option) => (
                  <ChoiceButton
                    key={option}
                    selected={maritalStatus === option}
                    onClick={() => setMaritalStatus(option)}
                  >
                    {option}
                  </ChoiceButton>
                ))}
              </div>
            </Field>
          </FieldGroup>
        </div>

        {mode === "wizard" ? (
          <div className="shrink-0 border-t px-6 py-4">
            {/* Always clickable; missing required fields get flagged in red. */}
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              className="h-12 w-full cursor-pointer rounded-sm bg-[#00a0e9] text-base font-medium text-white transition-colors hover:bg-[#00a0e9]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next to summary
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
