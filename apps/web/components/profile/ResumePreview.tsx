"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconBriefcase,
  IconCalendar,
  IconDotsVertical,
  IconDownload,
  IconFileDescription,
  IconGenderBigender,
  IconHeart,
  IconMail,
  IconMapPin,
  IconPaperclip,
  IconPencil,
  IconPhone,
  IconPlus,
  IconSchool,
  IconStar,
  IconTrash,
  IconUser,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";

import {
  resumeLocationLabel,
  type ResumeLocation,
} from "@/components/profile/ResumeLocationDialog";
import { cvMime, isValidCvFile } from "@/components/profile/resume-validation";
import {
  completeResumeAttachment,
  createResumeAttachment,
  deleteResumeAttachment,
  signResumeAttachment,
} from "@/actions/resume";
import DbImage from "@/components/common/DbImage";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Everything Step 1 collects — reported up so the finished view can show it. */
export interface ResumePersonalData {
  firstName: string;
  lastName: string;
  gender: string | null;
  dob: Date | null;
  nationality: string;
  email: string;
  education: string | undefined;
  maritalStatus: string | null;
  place: ResumeLocation;
  address: string;
  position: string;
  yearsOfExperience: string;
  phones: string[];
  photo: string | null;
}

/** One saved section entry — the forms submit these, the parent upserts by id. */
export interface ExperienceEntry {
  id: string;
  company: string;
  position: string;
  place: ResumeLocation;
  startDate: Date;
  endDate: Date | null;
  current: boolean;
  description: string;
}

export interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  major: string;
  startDate: Date;
  endDate: Date | null;
  current: boolean;
  description: string;
}

export interface SkillEntry {
  id: string;
  title: string;
  level: string;
}

export interface LanguageEntry {
  id: string;
  title: string;
  level: string;
}

export interface ReferenceEntry {
  id: string;
  name: string;
  company: string;
  position: string;
  phones: string[];
  email: string;
}

/** The Job Preferences form's entry — its own dialog, not a wizard step. */
export interface JobPreferenceEntry {
  id: string;
  openJob: boolean;
  position: string;
  category: string[];
  location: string[];
  jobType: string[];
}

/** The submitted value of any section form — string for the single-text ones. */
export type ResumeEntry =
  | ExperienceEntry
  | EducationEntry
  | SkillEntry
  | LanguageEntry
  | ReferenceEntry
  | string;

/** The uploaded CV file (private bucket — never a public URL). */
export interface ResumeAttachment {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
}

export interface ResumeDocumentData {
  personal: ResumePersonalData | null;
  summary: string;
  experiences: ExperienceEntry[];
  educations: EducationEntry[];
  skills: SkillEntry[];
  languages: LanguageEntry[];
  hobbies: string;
  references: ReferenceEntry[];
  jobPreference: JobPreferenceEntry | null;
  /** The CV file, or null when none was ever uploaded. */
  attachment: ResumeAttachment | null;
}

type ListStep = 3 | 4 | 5 | 6 | 7 | 8;
type SectionStep = 2 | ListStep;

/**
 * The five genuinely list-shaped sections — the only ones whose entries carry
 * a ⋮ menu, and therefore the only steps `onDeleteEntry` can ever receive
 * (Summary and Hobbies are edited, never removed).
 */
export type EntryListStep = 3 | 4 | 5 | 6 | 8;

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

/** The mock's date format: 2022-Feb. */
const formatMonthYear = (date: Date) =>
  `${date.getFullYear()}-${date.toLocaleDateString("en-US", { month: "short" })}`;

const formatRange = (start: Date, end: Date | null, current: boolean) =>
  `${formatMonthYear(start)} - ${
    current || !end ? "Present" : formatMonthYear(end)
  }`;

const byStartDesc = <T extends { startDate: Date }>(a: T, b: T) =>
  b.startDate.getTime() - a.startDate.getTime();

/** "1.2 MB" / "480 KB" — the size the storage actually holds. */
const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** The ⋮ per-entry menu: Edit reopens the form pre-filled, Delete removes it. */
function EntryMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Entry actions"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-muted"
        >
          <IconDotsVertical size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={onDelete}
          className="cursor-pointer"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A text block clamped to four lines, with a Show more / less toggle **only
 * when there is something hidden**. The toggle follows the actual overflow,
 * not a character count: a long summary that still fits inside the clamp
 * offers to reveal nothing, so it shows no link at all.
 */
function ClampedText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  /**
   * Measured on the clamped element. The effect deliberately skips while
   * expanded — lifting the clamp makes the paragraph fit, so re-measuring then
   * would erase the overflow flag and take "Show less" away with it.
   */
  useEffect(() => {
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const measure = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    measure();
    // Re-measure when the column narrows and the same text needs more lines.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={ref}
        className={cn(
          "text-base whitespace-pre-wrap text-foreground",
          !expanded && "line-clamp-4",
        )}
      >
        {text}
      </p>
      {truncated && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 cursor-pointer text-sm font-medium text-[#00a0e9] transition-colors hover:text-[#00a0e9]/80"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/**
 * The finished-resume view. Empty sections show their description + Add link
 * exactly as before; filled ones render the entries (the captain's mocks): the
 * ⋮ menu per entry edits/deletes it, dates read `2022-Feb - Present`, skills
 * and languages are one-liners. Chips and percent derive from the data.
 */
export function ResumePreview({
  doc,
  fallbackFirstName,
  fallbackLastName,
  onEdit,
  onEditField,
  onAdd,
  onEditEntry,
  onDeleteEntry,
  onJobPreference,
  onAttachmentChange,
}: {
  doc: ResumeDocumentData;
  fallbackFirstName: string;
  fallbackLastName: string;
  onEdit: () => void;
  onEditField: (field: string) => void;
  onAdd: (step: SectionStep) => void;
  onEditEntry: (step: SectionStep, entry: ResumeEntry) => void;
  onDeleteEntry: (step: EntryListStep, id: string) => void;
  onJobPreference: () => void;
  /** The CV card owns the upload flow and reports the new file upward. */
  onAttachmentChange?: (attachment: ResumeAttachment | null) => void;
}) {
  const [cvNoticed, setCvNoticed] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvRemoving, setCvRemoving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const data = doc.personal;
  const name =
    [data?.firstName || fallbackFirstName, data?.lastName || fallbackLastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Your Name";
  const phone = data?.phones.find((p) => p.trim() !== "") ?? "";
  const location = data?.place ? resumeLocationLabel(data.place) : "";

  const rows: {
    icon: typeof IconGenderBigender;
    label: string;
    value: string | null;
    link?: boolean;
  }[] = [
    { icon: IconGenderBigender, label: "Gender", value: data?.gender ?? null },
    {
      icon: IconCalendar,
      label: "Date Of Birth",
      value: data?.dob ? formatDate(data.dob) : null,
    },
    {
      icon: IconWorld,
      label: "Nationality",
      value: data?.nationality?.trim() || null,
    },
    {
      icon: IconHeart,
      label: "Marital Status",
      value: data?.maritalStatus ?? null,
    },
    { icon: IconPhone, label: "Phone", value: phone || null, link: true },
    { icon: IconMail, label: "Email", value: data?.email?.trim() || null },
    {
      icon: IconSchool,
      label: "Education Level",
      value: data?.education ?? null,
    },
    { icon: IconMapPin, label: "Location", value: location || null },
  ];

  type MissingItem = { label: string; filled: boolean } & (
    | { kind: "field"; field: string }
    | { kind: "section"; step: SectionStep }
    | { kind: "attachment" }
  );

  const summaryFilled = doc.summary.trim() !== "";
  const hobbiesFilled = doc.hobbies.trim() !== "";
  const items: MissingItem[] = [
    { label: "Photo", filled: !!data?.photo, kind: "field", field: "photo" },
    { label: "Gender", filled: !!data?.gender, kind: "field", field: "gender" },
    {
      label: "Date Of Birth",
      filled: !!data?.dob,
      kind: "field",
      field: "dob",
    },
    {
      label: "Nationality",
      filled: !!(data?.nationality?.trim() ?? ""),
      kind: "field",
      field: "nationality",
    },
    {
      label: "Email",
      filled: !!(data?.email?.trim() ?? ""),
      kind: "field",
      field: "email",
    },
    {
      label: "Location",
      filled: !!(data?.place?.province ?? ""),
      kind: "field",
      field: "location",
    },
    {
      label: "Address",
      filled: !!(data?.address?.trim() ?? ""),
      kind: "field",
      field: "address",
    },
    { label: "Phone", filled: !!phone, kind: "field", field: "phone" },
    {
      label: "Marital Status",
      filled: !!data?.maritalStatus,
      kind: "field",
      field: "marital",
    },
    {
      label: "Education Level",
      filled: !!data?.education,
      kind: "field",
      field: "education",
    },
    {
      label: "Position",
      filled: !!(data?.position?.trim() ?? ""),
      kind: "field",
      field: "position",
    },
    {
      label: "Years of Experience",
      filled: !!(data?.yearsOfExperience?.trim() ?? ""),
      kind: "field",
      field: "experience",
    },
    { label: "Summary", filled: summaryFilled, kind: "section", step: 2 },
    {
      label: "Educations",
      filled: doc.educations.length > 0,
      kind: "section",
      step: 4,
    },
    {
      label: "Work experience",
      filled: doc.experiences.length > 0,
      kind: "section",
      step: 3,
    },
    {
      label: "Skills",
      filled: doc.skills.length > 0,
      kind: "section",
      step: 5,
    },
    {
      label: "Hobbies & Interests",
      filled: hobbiesFilled,
      kind: "section",
      step: 7,
    },
    {
      label: "Languages",
      filled: doc.languages.length > 0,
      kind: "section",
      step: 6,
    },
    {
      label: "References",
      filled: doc.references.length > 0,
      kind: "section",
      step: 8,
    },
    { label: "Attachment", filled: !!doc.attachment, kind: "attachment" },
  ];
  const filledCount = items.filter((item) => item.filled).length;
  const percent = Math.round((filledCount / items.length) * 100);
  const missing = items.filter((item) => !item.filled);

  // The Job Preferences card always shows all five rows; blanks read
  // "Not defined" and Open Job reads Enable/Disable (the captain's mock).
  const jobPrefRows: { label: string; value: string }[] = [];
  if (doc.jobPreference) {
    jobPrefRows.push({
      label: "Open Job",
      value: doc.jobPreference.openJob ? "Enable" : "Disable",
    });
    jobPrefRows.push({
      label: "Preferred Position",
      value: doc.jobPreference.position.trim() || "Not defined",
    });
    jobPrefRows.push({
      label: "Categories",
      value: doc.jobPreference.category.length
        ? doc.jobPreference.category.join(" , ")
        : "Not defined",
    });
    jobPrefRows.push({
      label: "Locations",
      value: doc.jobPreference.location.length
        ? doc.jobPreference.location.join(" , ")
        : "Not defined",
    });
    jobPrefRows.push({
      label: "Job Type",
      value: doc.jobPreference.jobType.length
        ? doc.jobPreference.jobType.join(" , ")
        : "Not defined",
    });
  }

  function handleAttachment() {
    setCvNoticed(true);
    document
      .getElementById("resume-cv-card")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  /**
   * The CV handshake: reserve an object, PUT the bytes straight to storage
   * (the server never sees the file), then let the backend verify the size it
   * actually holds before the file is attached. A failure at any step leaves
   * the previous CV untouched.
   */
  async function handleCvPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isValidCvFile(file)) {
      toast.error("Choose a doc, DOCX, PDF or txt file (max 5MB).");
      return;
    }

    setCvUploading(true);
    const id = crypto.randomUUID();
    const created = await createResumeAttachment({
      id,
      fileName: file.name,
      declaredSize: file.size,
    });
    // A replayed create whose response was lost: the bytes are already up
    // (RESUME_ATTACHMENT_NOT_PENDING), so skip the PUT and complete.
    if (!created.ok && created.code !== "RESUME_ATTACHMENT_NOT_PENDING") {
      setCvUploading(false);
      toast.error(created.error);
      return;
    }
    if (created.ok) {
      const uploaded = await fetch(created.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": cvMime(file) },
      }).catch(() => null);
      if (!uploaded?.ok) {
        setCvUploading(false);
        toast.error("Couldn't upload your CV. Please try again.");
        return;
      }
    }

    const completed = await completeResumeAttachment(id);
    setCvUploading(false);
    if (!completed.ok) {
      toast.error(completed.error);
      return;
    }

    onAttachmentChange?.({
      id: completed.data.id,
      fileName: file.name,
      size: completed.data.size,
      uploadedAt: new Date().toISOString(),
    });
    toast.success("CV uploaded");
  }

  /** Open the uploaded CV through a short-lived signed URL, owner only. */
  async function handleDownload() {
    setDownloading(true);
    const signed = await signResumeAttachment();
    setDownloading(false);
    if (!signed.ok) {
      toast.error(signed.error);
      return;
    }
    if (!signed.url) {
      toast.error("There is no CV to download yet.");
      return;
    }
    window.open(signed.url, "_blank", "noopener");
  }

  /**
   * The filled row's remove control: drop the CV (and its stored object) and
   * settle on the empty state — chip un-filled, "Download resume" gone. The
   * route is idempotent, so a duplicated click is a no-op rather than an error.
   */
  async function handleCvRemove() {
    setCvRemoving(true);
    const removed = await deleteResumeAttachment();
    setCvRemoving(false);
    if (!removed.ok) {
      toast.error(removed.error);
      return;
    }
    onAttachmentChange?.(null);
    toast.success("CV removed");
  }

  function handleItem(item: MissingItem) {
    if (item.kind === "attachment") {
      handleAttachment();
      return;
    }
    if (item.kind === "section") {
      if (item.step === 2) onEditEntry(2, doc.summary);
      else if (item.step === 7) onEditEntry(7, doc.hobbies);
      else onAdd(item.step);
      return;
    }
    onEditField(item.field);
  }

  const cardHeader = (
    Icon: typeof IconFileDescription,
    title: string,
    onAddClick: () => void,
    addAria: string,
  ) => (
    <div className="flex items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Icon size={22} />
      </span>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <button
        type="button"
        aria-label={addAria}
        onClick={onAddClick}
        className="ml-auto flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#00a0e9] text-white transition-colors hover:bg-[#00a0e9]/90"
      >
        <IconPlus size={15} />
      </button>
    </div>
  );

  const addLink = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 flex cursor-pointer items-center gap-2 text-[#00a0e9] transition-colors hover:text-[#00a0e9]/80"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00a0e9] text-white">
        <IconPlus size={13} />
      </span>
      <span className="text-base font-medium">{label}</span>
    </button>
  );

  /** The filled-state header: same as cardHeader but with the pencil, no +. */
  const cardHeaderFilled = (
    Icon: typeof IconFileDescription,
    title: string,
    onEditClick: () => void,
  ) => (
    <div className="flex items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
        <Icon size={22} />
      </span>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <button
        type="button"
        aria-label={`Edit ${title}`}
        onClick={onEditClick}
        className="ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#00a0e9] transition-colors hover:bg-[#00a0e9]/10"
      >
        <IconPencil size={18} />
      </button>
    </div>
  );

  /** The pencil + label link the single-text cards close with. */
  const editLink = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 flex cursor-pointer items-center gap-2 text-[#00a0e9] transition-colors hover:text-[#00a0e9]/80"
    >
      <IconPencil size={16} />
      <span className="text-base font-medium">{label}</span>
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6 px-4 pt-4">
      {/* Resume (CV) */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-center justify-between border-b pb-4">
          <h1 className="text-xl font-bold text-foreground">Resume (CV)</h1>
          {/* Hidden, never inert: nothing to download means no control. */}
          {doc.attachment && (
            <button
              type="button"
              aria-label="Download resume"
              onClick={handleDownload}
              disabled={downloading}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#00a0e9] transition-colors hover:bg-[#00a0e9]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconDownload size={22} />
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-6 sm:flex-row">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">{name}</h2>
            <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
              {rows.map(({ icon: Icon, label, value, link }) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <Icon size={16} className="shrink-0 text-gray-500" />
                  <span className="text-gray-500">{label}:</span>
                  <span
                    className={
                      link && value ? "text-[#00a0e9]" : "text-foreground"
                    }
                  >
                    {value ?? "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3 x 4 photo — a DB image, so it renders through DbImage */}
          <div className="relative h-[215px] w-[190px] shrink-0 overflow-hidden rounded-sm border">
            <DbImage
              src={data?.photo ?? ""}
              alt="Resume photo"
              width={188}
              height={213}
              className="h-full w-full object-cover"
              fallback={
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <IconUser
                    size={64}
                    strokeWidth={1.5}
                    className="text-gray-400"
                  />
                  <span className="text-base text-gray-500">3 x 4</span>
                </div>
              }
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="mt-6 h-11 w-full cursor-pointer rounded-sm bg-[#00a0e9]/10 text-base font-medium text-[#00a0e9] transition-colors hover:bg-[#00a0e9]/20"
        >
          Edit Personal Details
        </button>
      </div>

      {/* Completed Profile */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-bold text-foreground">Completed Profile</h2>
        <p className="mt-3 text-base text-foreground">{percent}% Completed</p>
        <div className="mt-3 h-1.5 w-full rounded-full bg-red-500/15">
          <div
            className="h-full rounded-full bg-red-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {missing.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleItem(item)}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-[#00a0e9]/10 px-3 text-sm text-foreground transition-colors hover:bg-[#00a0e9]/20"
            >
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#00a0e9] text-white">
                <IconPlus size={12} />
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {summaryFilled
          ? cardHeaderFilled(IconFileDescription, "Summary", () =>
              onEditEntry(2, doc.summary),
            )
          : cardHeader(
              IconFileDescription,
              "Summary",
              () => onAdd(2),
              "Add summary",
            )}
        <div className="mt-4 border-t" />
        {summaryFilled ? (
          <div className="mt-4">
            <ClampedText text={doc.summary} />
            {editLink("Edit Summary", () => onEditEntry(2, doc.summary))}
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-muted-foreground">
              Write 2–4 concise, energetic sentences that highlight your role,
              experience, key achievements, and strongest qualities.
            </p>
            {addLink("Add Summary", () => onAdd(2))}
          </>
        )}
      </div>

      {/* Work Experiences */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {cardHeader(
          IconBriefcase,
          "Work Experiences",
          () => onAdd(3),
          "Add experience",
        )}
        <div className="mt-4 border-t" />
        {doc.experiences.length > 0 ? (
          <div>
            <div className="mt-1">
              {[...doc.experiences].sort(byStartDesc).map((x) => (
                <div
                  key={x.id}
                  className="flex items-start gap-3 border-b border-border py-4 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">
                      {x.company}
                    </p>
                    <p className="text-sm italic text-muted-foreground">
                      {formatRange(x.startDate, x.endDate, x.current)}
                    </p>
                    <p className="text-base text-foreground">
                      {x.position}
                      {x.place?.province
                        ? ` · ${resumeLocationLabel(x.place)}`
                        : ""}
                    </p>
                    {x.description && (
                      <p className="mt-1 line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">
                        {x.description}
                      </p>
                    )}
                  </div>
                  <EntryMenu
                    onEdit={() => onEditEntry(3, x)}
                    onDelete={() => onDeleteEntry(3, x.id)}
                  />
                </div>
              ))}
            </div>
            {addLink("Add Experience", () => onAdd(3))}
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-muted-foreground">
              Show your most relevant experience from the past 10 years,
              focusing on impact and measurable achievements.
            </p>
            {addLink("Add Experience", () => onAdd(3))}
          </>
        )}
      </div>

      {/* Educations */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {cardHeader(IconSchool, "Educations", () => onAdd(4), "Add education")}
        <div className="mt-4 border-t" />
        {doc.educations.length > 0 ? (
          <div>
            <div className="mt-1">
              {[...doc.educations].sort(byStartDesc).map((x) => (
                <div
                  key={x.id}
                  className="flex items-start gap-3 border-b border-border py-4 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">
                      {x.school}
                    </p>
                    <p className="text-sm italic text-muted-foreground">
                      {formatRange(x.startDate, x.endDate, x.current)}
                    </p>
                    <p className="text-base text-foreground">
                      {x.degree} in {x.major}
                    </p>
                    {x.description && (
                      <p className="mt-1 line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">
                        {x.description}
                      </p>
                    )}
                  </div>
                  <EntryMenu
                    onEdit={() => onEditEntry(4, x)}
                    onDelete={() => onDeleteEntry(4, x.id)}
                  />
                </div>
              ))}
            </div>
            {addLink("Add Education", () => onAdd(4))}
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-muted-foreground">
              Present your educational background to demonstrate the knowledge
              and value you bring to the role.
            </p>
            {addLink("Add Education", () => onAdd(4))}
          </>
        )}
      </div>

      {/* Skills */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {cardHeader(IconStar, "Skills", () => onAdd(5), "Add skill")}
        <div className="mt-4 border-t" />
        {doc.skills.length > 0 ? (
          <div>
            <div className="mt-1">
              {doc.skills.map((x) => (
                <div
                  key={x.id}
                  className="flex items-center gap-3 border-b border-border py-3.5 last:border-0 last:pb-0"
                >
                  <p className="min-w-0 flex-1 text-base text-foreground">
                    <span className="font-semibold">{x.title}</span>
                    {" • "}
                    {x.level}
                  </p>
                  <EntryMenu
                    onEdit={() => onEditEntry(5, x)}
                    onDelete={() => onDeleteEntry(5, x.id)}
                  />
                </div>
              ))}
            </div>
            {addLink("Add Skill", () => onAdd(5))}
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-muted-foreground">
              List the skills that best represent your strengths and help you
              stand out from other candidates.
            </p>
            {addLink("Add Skill", () => onAdd(5))}
          </>
        )}
      </div>

      {/* Languages */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {cardHeader(IconWorld, "Languages", () => onAdd(6), "Add language")}
        <div className="mt-4 border-t" />
        {doc.languages.length > 0 ? (
          <div>
            <div className="mt-1">
              {doc.languages.map((x) => (
                <div
                  key={x.id}
                  className="flex items-center gap-3 border-b border-border py-3.5 last:border-0 last:pb-0"
                >
                  <p className="min-w-0 flex-1 text-base text-foreground">
                    <span className="font-semibold">{x.title}</span>
                    {" • "}
                    {x.level}
                  </p>
                  <EntryMenu
                    onEdit={() => onEditEntry(6, x)}
                    onDelete={() => onDeleteEntry(6, x.id)}
                  />
                </div>
              ))}
            </div>
            {addLink("Add Language", () => onAdd(6))}
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-muted-foreground">
              Add the languages you speak to increase your opportunities with
              more companies and employers.
            </p>
            {addLink("Add Language", () => onAdd(6))}
          </>
        )}
      </div>

      {/* Hobbies & Interests */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {hobbiesFilled
          ? cardHeaderFilled(IconHeart, "Hobbies & Interests", () =>
              onEditEntry(7, doc.hobbies),
            )
          : cardHeader(
              IconHeart,
              "Hobbies & Interests",
              () => onAdd(7),
              "Add hobbies and interests",
            )}
        <div className="mt-4 border-t" />
        {hobbiesFilled ? (
          <div className="mt-4">
            <ClampedText text={doc.hobbies} />
            {editLink("Edit Hobbies & Interests", () =>
              onEditEntry(7, doc.hobbies),
            )}
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-muted-foreground">
              Share what you enjoy doing to give employers a sense of your
              personality.
            </p>
            {addLink("Add Hobbies & Interests", () => onAdd(7))}
          </>
        )}
      </div>

      {/* References */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {cardHeader(IconUsers, "References", () => onAdd(8), "Add reference")}
        <div className="mt-4 border-t" />
        {doc.references.length > 0 ? (
          <div>
            <div className="mt-1">
              {doc.references.map((x) => {
                const contacts = [
                  x.phones.filter((p) => p.trim() !== "").join(" · "),
                  x.email.trim(),
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={x.id}
                    className="flex items-start gap-3 border-b border-border py-4 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-foreground">
                        {x.name}
                      </p>
                      <p className="text-base text-foreground">
                        {[x.position, x.company].filter(Boolean).join(", ")}
                      </p>
                      {contacts && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {contacts}
                        </p>
                      )}
                    </div>
                    <EntryMenu
                      onEdit={() => onEditEntry(8, x)}
                      onDelete={() => onDeleteEntry(8, x.id)}
                    />
                  </div>
                );
              })}
            </div>
            {addLink("Add Reference", () => onAdd(8))}
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-muted-foreground">
              Add professional references to support your experience and
              increase employer confidence.
            </p>
            {addLink("Add Reference", () => onAdd(8))}
          </>
        )}
      </div>

      {/* CV / Resume upload — the title turns amber when the Attachment chip
          sends the user here (the captain's ask: normal by default). */}
      <div
        id="resume-cv-card"
        className="rounded-2xl border bg-card p-6 sm:p-8"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <IconPaperclip size={22} />
          </span>
          <h2
            className={cn(
              "text-xl font-bold",
              cvNoticed ? "text-amber-500" : "text-foreground",
            )}
          >
            CV / Resume
          </h2>
        </div>
        <p className="mt-4 text-base text-foreground">
          Uploading a new file will replace your current resume details.
          You&apos;ll get to review everything before it&apos;s saved.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Support file types: doc, DOCX, PDF, txt. (Max size: 5MB)
        </p>
        {doc.attachment && (
          <div className="mt-4 flex items-center gap-3 rounded-sm border px-3 py-2.5">
            <IconFileDescription
              size={20}
              className="shrink-0 text-[#00a0e9]"
            />
            <span className="min-w-0 flex-1 truncate text-base text-foreground">
              {doc.attachment.fileName}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {formatFileSize(doc.attachment.size)}
            </span>
            <button
              type="button"
              aria-label="Remove CV"
              onClick={handleCvRemove}
              disabled={cvRemoving}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-muted hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconTrash size={18} />
            </button>
          </div>
        )}
        <input
          ref={cvInputRef}
          type="file"
          accept=".doc,.docx,.pdf,.txt"
          className="hidden"
          onChange={handleCvPick}
        />
        <button
          type="button"
          onClick={() => cvInputRef.current?.click()}
          disabled={cvUploading}
          className="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-sm bg-[#00a0e9]/10 text-base font-medium text-[#00a0e9] transition-colors hover:bg-[#00a0e9]/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconPaperclip size={18} />
          {cvUploading
            ? "Uploading…"
            : doc.attachment
              ? "Replace file (CV)"
              : "Upload file (CV)"}
        </button>
      </div>

      {/* Job Preferences */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        {doc.jobPreference
          ? cardHeaderFilled(IconBriefcase, "Job Preferences", onJobPreference)
          : cardHeader(
              IconBriefcase,
              "Job Preferences",
              onJobPreference,
              "Add preference",
            )}
        <div className="mt-4 border-t" />
        {doc.jobPreference ? (
          <div>
            {jobPrefRows.map(({ label, value }) => (
              <div
                key={label}
                className="border-b border-border py-4 last:border-0"
              >
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-base font-semibold text-foreground">
                  {value}
                </p>
              </div>
            ))}
            {editLink("Edit Preference", onJobPreference)}
          </div>
        ) : (
          <>
            <p className="mt-4 text-base text-muted-foreground">
              Tell us about the type of job you&apos;re looking for so we can
              help you find the right match faster.
            </p>
            {addLink("Add Preference", onJobPreference)}
          </>
        )}
      </div>
    </div>
  );
}
