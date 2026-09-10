"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, Lock, SendHorizonal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { deleteChatUpload, signChatUpload } from "@/actions/chat";

// Mirrors the backend FilesService image validation (5MB, image/*).
const MAX_SIZE = 5 * 1024 * 1024;

export interface ComposerDraft {
  body?: string;
  imagePath?: string;
  imageUrl?: string;
}

interface StagedImage {
  path: string;
  url: string;
}

export function Composer({
  disabled,
  disabledReason,
  sending,
  onSend,
  onActivity,
}: {
  disabled: boolean;
  disabledReason?: string;
  sending: boolean;
  onSend: (draft: ComposerDraft) => void;
  onActivity?: () => void;
}) {
  const t = useTranslations("Chat");
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<StagedImage | null>(null);
  const [uploading, setUploading] = useState(false);

  const canSend = !disabled && !sending && (text.trim() !== "" || staged !== null);

  function submit() {
    if (!canSend) return;
    onSend({
      body: text.trim() || undefined,
      imagePath: staged?.path,
      imageUrl: staged?.url,
    });
    setText("");
    setStaged(null);
  }

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
      // Signed via `signChatUpload`, which runs on the USER token — the
      // backend mints `chat/{myUserId}/…` and rejects any send whose
      // imagePath sits outside the sender's own prefix.
      const signed = await signChatUpload(file.name);
      if (!signed.ok) {
        toast.error(signed.message || t("composer.uploadFailed"));
        return;
      }
      const res = await fetch(signed.data.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) {
        toast.error(t("composer.uploadFailed"));
        return;
      }
      setStaged({ path: signed.data.path, url: signed.data.publicUrl });
      onActivity?.();
    } catch {
      toast.error(t("composer.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  function discardStaged() {
    const current = staged;
    setStaged(null);
    // Fire-and-forget cleanup so an abandoned pick doesn't linger in storage.
    if (current) void deleteChatUpload(current.path);
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
      {staged && (
        <div className="flex items-center gap-2 px-3 pt-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
            <Image
              src={staged.url}
              alt={t("composer.stagedImageAlt")}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          </div>
          <button
            type="button"
            onClick={discardStaged}
            aria-label={t("composer.removeImage")}
            className="rounded-full border border-border p-1 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-2 py-2.5 sm:px-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || sending}
          aria-label={t("composer.attachImage")}
          className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <ImageIcon className="size-[18px]" />
          )}
        </button>

        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onActivity?.();
          }}
          placeholder={t("composer.placeholder")}
          aria-label={t("composer.placeholder")}
          className="h-10 flex-1 rounded-full border-none bg-muted px-4 text-sm focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
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
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
