"use client";

import { useRef, useState } from "react";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "../ui/button";
import { X, ImagePlus, Images } from "lucide-react";
import Image from "next/image";
import { toast } from "@/components/ui/sonner";
import { signFeedbackUpload, submitFeedback } from "@/actions/feedback";
import { normalizePhone } from "@/lib/phone";

const MAX_PHOTOS = 24;
const NAME_MAX = 200;
const EMAIL_MAX = 254;
const DESCRIPTION_MAX = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Photo = {
  id: string;
  file: File;
  previewUrl: string;
  path: string | null;
};

export default function Feedback() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Single ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drop = (id: string) => {
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const removeAt = (index: number) => {
    const item = photos[index];
    if (item) drop(item.id);
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const uploadOne = async (entry: Photo) => {
    try {
      const signed = await signFeedbackUpload(entry.file.name);
      if (!signed.success) {
        toast.error(signed.error);
        drop(entry.id);
        return;
      }
      const res = await fetch(signed.data.signedUrl, {
        method: "PUT",
        body: entry.file,
        headers: { "Content-Type": entry.file.type },
      });
      if (!res.ok) {
        toast.error("Failed to upload a photo");
        drop(entry.id);
        return;
      }
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === entry.id ? { ...p, path: signed.data.path } : p,
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

    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const accepted = selected.slice(0, room);
    if (!accepted.length) return;

    const entries: Photo[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      path: null,
    }));
    setPhotos((prev) => [...prev, ...entries]);
    setUploading((n) => n + entries.length);
    void Promise.all(entries.map((entry) => uploadOne(entry)));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter your name";
    else if (name.trim().length > NAME_MAX)
      next.name = `Name must be ${NAME_MAX} characters or fewer`;
    if (!normalizePhone(phone)) next.phone = "Enter a valid phone number";
    if (email.trim() && !EMAIL_RE.test(email.trim()))
      next.email = "Enter a valid email address";
    else if (email.trim().length > EMAIL_MAX)
      next.email = `Email must be ${EMAIL_MAX} characters or fewer`;
    if (!description.trim())
      next.description = "Tell us how we can improve here";
    else if (description.trim().length > DESCRIPTION_MAX)
      next.description = `Feedback must be ${DESCRIPTION_MAX} characters or fewer`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (uploading > 0) {
      toast.error("Please wait for the photos to finish uploading.");
      return;
    }

    setSubmitting(true);
    const result = await submitFeedback({
      name: name.trim(),
      phone: normalizePhone(phone),
      email: email.trim() || undefined,
      description: description.trim(),
      imagePaths: photos.flatMap((p) => (p.path ? [p.path] : [])),
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to submit feedback");
      return;
    }

    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setName("");
    setPhone("");
    setEmail("");
    setDescription("");
    setErrors({});
    toast.success("Thanks for your feedback!");
  };

  return (
    <form onSubmit={handleSubmit} className="min-h-screen bg-muted pb-10">
      <div className="max-w-4xl mx-auto py-6 px-2">
        <h1 className="text-2xl font-medium text-foreground">Feedback</h1>

        <div className="bg-card rounded-sm border p-4 mt-4 ">
          Give feedback about your Psakhmer experience.
        </div>
        <div className="bg-card rounded-sm border p-4 mt-3">
          <h2 className="text-base">Photo ({photos.length}/24)</h2>
          <div className="border-t border-muted-foreground/20 mt-2" />
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex gap-2 overflow-x-auto pb-4 mt-2 scrollbar-hide">
            {/* Map 24 total slots */}
            {Array.from({ length: MAX_PHOTOS }).map((_, index) => {
              const photo = photos[index];
              const isNextSlot = index === photos.length;

              return (
                <div key={index} className="relative w-20 h-16 shrink-0">
                  {photo ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={photo.previewUrl}
                        alt="upload"
                        fill
                        unoptimized
                        className="object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        onClick={() => removeAt(index)}
                        className="absolute -top-0 -right-0 bg-red-500 text-card rounded-full w-5 h-5 flex items-center justify-center z-10 shadow-sm border-none cursor-pointer"
                      >
                        <X size={12} strokeWidth={3} />
                      </Button>
                    </div>
                  ) : (
                    /* EMPTY / UPLOAD BUTTON STATE */
                    <div
                      onClick={triggerUpload}
                      className="flex flex-col items-center justify-center w-full h-full rounded-md cursor-pointer transition-all border bg-muted hover:bg-card/70"
                    >
                      {isNextSlot ? (
                        <>
                          <Images className="w-8 h-8 text-muted-foreground " />
                          <span className="text-xs text-muted-foreground mt-1">
                            Upload
                          </span>
                        </>
                      ) : (
                        <ImagePlus className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-card rounded-sm border p-4 mt-4">
          <FieldSet>
            <FieldGroup className="space-y-1">
              <Field>
                <FieldLabel>
                  Name<span className="text-red-500">*</span>
                </FieldLabel>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="rounded-sm"
                  maxLength={NAME_MAX}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
                <p
                  className={`text-right text-xs ${
                    name.length >= NAME_MAX
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {name.length >= NAME_MAX ? "Maximum reached — " : ""}
                  {name.length}/{NAME_MAX}
                </p>
              </Field>
              <Field>
                <FieldLabel>
                  Phone<span className="text-red-500">*</span>
                </FieldLabel>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your Phone Number"
                  className="rounded-sm"
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && (
                  <p className="text-sm text-red-500">{errors.phone}</p>
                )}
              </Field>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your Email Address"
                  className="rounded-sm"
                  maxLength={EMAIL_MAX}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </Field>
              <Field>
                <FieldLabel>
                  Tell us how we can improve here
                  <span className="text-red-500">*</span>
                </FieldLabel>
                <Textarea
                  id="feedback"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-40 rounded-sm"
                  placeholder="Your feedback helps us improve..."
                  maxLength={DESCRIPTION_MAX}
                  aria-invalid={Boolean(errors.description)}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description}</p>
                )}
                <p
                  className={`text-right text-xs ${
                    description.length >= DESCRIPTION_MAX
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {description.length >= DESCRIPTION_MAX
                    ? "Maximum reached — "
                    : ""}
                  {description.length}/{DESCRIPTION_MAX}
                </p>
              </Field>
            </FieldGroup>
          </FieldSet>
        </div>
        <div className="bg-card rounded-sm border p-4 mt-4 text-center md:text-left">
          <p className="text-sm text-foreground">
            Thanks for taking the time to give us feedback. Though we can&apos;t
            review every submission, we use your input to improve the experience
            for everyone.
          </p>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-orange-500 hover:bg-orange-600 text-card rounded-sm h-10 mt-4 w-full text-sm font-medium transition-all cursor-pointer"
          >
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </form>
  );
}
