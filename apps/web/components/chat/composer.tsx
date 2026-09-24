"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Lock, SendHorizonal, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { storeDraftImage, removeDraftImage } from "@/lib/chat-draft-images";

export interface ComposerDraft {
  body?: string;
  /** Draft-image registry keys — uploaded to Supabase on send. */
  draftKeys?: string[];
}

interface StagedImage {
  key: string;
  previewUrl: string;
}

// Mirrors the backend FilesService image validation (5MB).
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function Composer({
  disabled,
  disabledReason,
  sending,
  onSend,
  onActivity,
  hasListing = false,
}: {
  disabled: boolean;
  disabledReason?: string;
  sending: boolean;
  onSend: (draft: ComposerDraft) => void;
  onActivity?: () => void;
  /** When true, listing counts toward the 5-image limit. */
  hasListing?: boolean;
}) {
  const t = useTranslations("Chat");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<StagedImage[]>([]);

  const maxAllowed = hasListing ? MAX_IMAGES - 1 : MAX_IMAGES;
  const remaining = maxAllowed - staged.length;

  // Release unsent drafts when the composer unmounts (e.g. switching threads).
  // Sent drafts are no longer in `staged`; the send path cleans those up.
  const stagedRef = useRef(staged);
  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);
  useEffect(
    () => () => stagedRef.current.forEach((s) => removeDraftImage(s.key)),
    [],
  );

  const canSend =
    !disabled && !sending && (text.trim() !== "" || staged.length > 0);

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend({
      body: text.trim() || undefined,
      draftKeys: staged.map((s) => s.key),
    });
    setText("");
    setStaged([]);
  }, [canSend, text, staged, onSend]);

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    const valid: File[] = [];
    let badType = false;
    let tooLarge = false;
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) badType = true;
      else if (file.size > MAX_SIZE) tooLarge = true;
      else valid.push(file);
    }
    if (badType) toast.error(t("composer.imageTypeError"));
    if (tooLarge) toast.error(t("composer.imageSizeError"));

    // Trim to the free slots up front — one toast, and no draft is created
    // only to be thrown away.
    const accepted = valid.slice(0, Math.max(0, remaining));
    if (valid.length > accepted.length) {
      toast.error(t("composer.imageLimitError", { max: maxAllowed }));
    }
    if (accepted.length === 0) return;

    const added = accepted.map((file) => {
      const draft = storeDraftImage(file);
      return { key: draft.key, previewUrl: draft.previewUrl };
    });
    setStaged((prev) => [...prev, ...added]);
    onActivity?.();
  }

  function discardStaged(index: number) {
    const item = staged[index];
    if (!item) return;
    removeDraftImage(item.key);
    setStaged((prev) => prev.filter((_, i) => i !== index));
  }

  if (disabled) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-4 py-4 text-xs text-muted-foreground">
        <Lock className="size-4 shrink-0" />
        <span>{disabledReason ?? t("composer.disabled")}</span>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border bg-card">
      {staged.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
          {staged.map((s, i) => (
            <div
              key={s.key}
              className="relative h-16 w-16 overflow-hidden rounded-lg border border-border"
            >
              <Image
                src={s.previewUrl}
                alt={t("composer.stagedImageAlt")}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => discardStaged(i)}
                aria-label={t("composer.removeImage")}
                className="absolute right-0 top-0 rounded-full border border-border bg-background/80 p-0.5 text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <span
            className={cn(
              "text-xs tabular-nums",
              remaining <= 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {staged.length}/{maxAllowed}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-2 py-2.5 sm:px-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || remaining <= 0}
          aria-label={t("composer.attachImage")}
          className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <ImageIcon className="size-[18px]" />
        </button>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onActivity?.();
          }}
          placeholder={t("composer.placeholder")}
          aria-label={t("composer.placeholder")}
          rows={1}
          className="h-10 max-h-24 flex-1 resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded-full border-none bg-muted px-4 py-2 text-sm focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files).filter((f) =>
              f.type.startsWith("image/"),
            );
            if (files.length === 0) return;
            e.preventDefault();
            addFiles(files);
          }}
        />

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={t("composer.send")}
          className={cn(
            "shrink-0 rounded-full p-2 transition-colors",
            canSend
              ? "text-sky-500 hover:bg-muted"
              : "cursor-not-allowed text-muted-foreground/50",
          )}
        >
          {sending ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <SendHorizonal className="size-[18px]" />
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
