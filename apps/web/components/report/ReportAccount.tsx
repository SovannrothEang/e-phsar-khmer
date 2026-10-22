"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/i18n/routing";
import { ImagePlus, Images, Loader2, X } from "lucide-react";
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
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "@/components/ui/sonner";
import { signUploadUser } from "@/actions/files";
import { createReport, loadReportReasons } from "@/actions/reports";
import { User } from "@/lib/user";

/** Real profiles carry a UUID; mock profiles carry a numeric id. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The captain's mock: 24 evidence slots, one horizontal strip. */
const MAX_PHOTOS = 24;

type Evidence = {
  id: string;
  previewUrl: string;
  file: File;
  /** Storage path, set only after the signed PUT succeeds. */
  path: string | null;
};

interface ReportAccountProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportAccount({
  user,
  open,
  onOpenChange,
}: ReportAccountProps) {
  const t = useTranslations();
  const router = useRouter();
  const [reasonId, setReasonId] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [uploading, setUploading] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: reasons = [], isLoading } = useQuery({
    queryKey: ["report-reasons", "user"],
    queryFn: () => loadReportReasons("user"),
    enabled: open,
    staleTime: 10 * 60_000,
  });

  const triggerUpload = () => fileInputRef.current?.click();

  const removeAt = (index: number) => {
    setEvidence((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadOne = async (entry: Evidence) => {
    try {
      const signed = await signUploadUser(entry.file.name, "report");
      if (!signed.success) {
        toast.error(signed.error);
        setEvidence((prev) => prev.filter((e) => e.id !== entry.id));
        URL.revokeObjectURL(entry.previewUrl);
        return;
      }
      const res = await fetch(signed.data.signedUrl, {
        method: "PUT",
        body: entry.file,
        headers: { "Content-Type": entry.file.type },
      });
      if (!res.ok) {
        toast.error(t("Report.uploadFailed"));
        setEvidence((prev) => prev.filter((e) => e.id !== entry.id));
        URL.revokeObjectURL(entry.previewUrl);
        return;
      }
      setEvidence((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, path: signed.data.path } : e,
        ),
      );
    } finally {
      setUploading((n) => Math.max(0, n - 1));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!selected.length) return;

    const room = Math.max(0, MAX_PHOTOS - evidence.length);
    const accepted = selected.slice(0, room);
    if (!accepted.length) return;

    const entries: Evidence[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      file,
      path: null,
    }));
    setEvidence((prev) => [...prev, ...entries]);
    setUploading((n) => n + entries.length);
    void Promise.all(entries.map((entry) => uploadOne(entry)));
  };

  // The dialog stays mounted (the parent owns `open`), so closing must clear
  // the form. Done in the close handler rather than an effect — every close
  // path (Cancel, Escape, overlay, submit) goes through this function.
  const reset = () => {
    setEvidence((prev) => {
      prev.forEach((e) => URL.revokeObjectURL(e.previewUrl));
      return [];
    });
    setReasonId("");
    setDescription("");
    setUploading(0);
    setSubmitting(false);
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = String(user.userId);
    if (!UUID_RE.test(targetId)) {
      toast.error(t("Report.accountCannotReport"));
      return;
    }
    if (!reasonId) {
      toast.error(t("Report.chooseReasonError"));
      return;
    }
    if (uploading > 0) {
      toast.error(t("Report.waitForPhotos"));
      return;
    }

    setSubmitting(true);
    const result = await createReport({
      targetType: "user",
      targetId,
      reasonId,
      description: description.trim() || undefined,
      imagePaths: evidence.flatMap((item) => (item.path ? [item.path] : [])),
    });
    setSubmitting(false);

    if (!result.success) {
      if (result.status === 401) {
        toast.error(t("Report.signInAccount"));
        handleOpenChange(false);
        router.push("/login");
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success(t("Report.submitted"));
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="p-5 sm:max-w-2xl sm:p-6">
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <DialogHeader>
            <DialogTitle>
              {t("Report.accountTitle", {
                name:
                  user?.name?.toUpperCase() || t("Report.accountFallbackTitle"),
              })}
            </DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="space-y-2">
            <h2 className="text-sm">
              {t("Report.photoCount", { count: evidence.length })}
            </h2>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {/* `min-w-0` keeps the 24 shrink-0 slots scrolling inside the
                dialog instead of widening the grid column past `max-w-2xl`. */}
            <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-2">
              {/* The mock always shows all 24 slots; filled ones scroll. */}
              {Array.from({ length: MAX_PHOTOS }).map((_, index) => {
                const item = evidence[index];
                const isNextSlot = index === evidence.length;
                return (
                  <div key={index} className="relative h-16 w-20 shrink-0">
                    {item ? (
                      <div className="relative h-full w-full">
                        {/* eslint-disable-next-line @next/next/no-img-element -- client-side object URL preview */}
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="h-full w-full rounded-md border border-muted object-cover"
                        />
                        {item.path === null ? (
                          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
                            <Loader2 className="h-5 w-5 animate-spin text-white" />
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeAt(index)}
                          className="absolute -right-1 -top-1 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-red-500 text-card shadow-sm"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={triggerUpload}
                        className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-md border bg-muted transition-colors hover:bg-muted/70"
                      >
                        {isNextSlot ? (
                          <>
                            <Images className="h-7 w-7 text-muted-foreground" />
                            <span className="mt-1 text-xs text-muted-foreground">
                              {t("Common.upload")}
                            </span>
                          </>
                        ) : (
                          <ImagePlus className="h-6 w-6 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel className="text-sm">
                {t("Report.reason")} <span className="text-red-500">*</span>
              </FieldLabel>
              <Select value={reasonId} onValueChange={setReasonId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoading
                        ? t("Report.loadingReasons")
                        : t("Report.selectReason")
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
                  {t("Report.reasonsFailed")}
                </p>
              ) : null}
              <Field className="pt-2">
                <FieldLabel>{t("Report.descriptionLabel")}</FieldLabel>
                <Textarea
                  id="message"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("Report.messagePlaceholder")}
                  className="min-h-[200px]"
                />
              </Field>
            </Field>
          </FieldGroup>
          <DialogFooter className="flex flex-row justify-between">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-1/3 cursor-pointer rounded-sm bg-muted-foreground/10 text-foreground hover:bg-muted-foreground/20"
              >
                {t("Common.cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={submitting || uploading > 0 || !reasonId}
              className="h-10 w-2/3 cursor-pointer rounded-sm bg-orange-400 text-card hover:bg-orange-500 disabled:opacity-60"
            >
              {submitting
                ? t("Common.submitting")
                : uploading > 0
                  ? t("Common.uploading")
                  : t("Common.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
