"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Lock, SendHorizonal, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  storeDraftImage,
  removeDraftImage,
  clearAllDrafts,
} from "@/lib/chat-draft-images";

export interface ComposerDraft {
  body?: string;
  /** localStorage keys for draft images — uploaded to Supabase on send. */
  draftKeys?: string[];
}

interface StagedImage {
  key: string;
  dataUrl: string;
}

// Mirrors the backend FilesService image validation (5MB).
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

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
  const [uploading, setUploading] = useState(false);

  const maxAllowed = hasListing ? MAX_IMAGES - 1 : MAX_IMAGES;
  const remaining = maxAllowed - staged.length;

  // Cleanup all drafts when tab/window closes.
  useEffect(() => {
    function handleBeforeUnload() {
      clearAllDrafts();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(t("composer.imageTypeError"));
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error(t("composer.imageSizeError"));
      return;
    }
    setUploading(true);
    try {
      // Use random ID to avoid key collisions on rapid picks.
      const tempId = crypto.randomUUID();
      const draft = await storeDraftImage(tempId, staged.length, file);
      let accepted = false;
      setStaged((prev) => {
        // Re-check limit inside the updater — concurrent pastes see stale state.
        if (prev.length >= maxAllowed) return prev;
        accepted = true;
        return [...prev, { key: draft.key, dataUrl: draft.dataUrl }];
      });
      if (!accepted) {
        removeDraftImage(draft.key);
        toast.error(t("composer.imageLimitError", { max: maxAllowed }));
        return;
      }
      onActivity?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("composer.uploadFailed"),
      );
    } finally {
      setUploading(false);
    }
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
            <div key={s.key} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
              <Image
                src={s.dataUrl}
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
        </div>
      )}

      <div className="flex items-center gap-1.5 px-2 py-2.5 sm:px-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending || remaining <= 0}
          aria-label={t("composer.attachImage")}
          className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <ImageIcon className="size-[18px]" />
          )}
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
            // Sequential so limit/quota checks see prior staged results.
            void (async () => {
              for (const f of files) {
                await handleFile(f);
              }
            })();
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
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files) {
            // Sequential so limit/quota checks see prior staged results.
            void (async () => {
              for (const f of Array.from(files)) {
                await handleFile(f);
              }
            })();
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
