"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { signUpload, type UploadScope } from "@/actions/files";

// Mirrors backend FilesService.validateImage (5MB, image/*).
const MAX_SIZE = 5 * 1024 * 1024;

interface ImageUploadProps {
  scope: UploadScope;
  value: string;
  onChange: (url: string) => void;
  label?: string;
  accept?: string;
  className?: string;
}

/**
 * Single-image uploader. Picks a file, obtains a Supabase signed upload URL via
 * the `signUpload` server action, PUTs the bytes directly to Supabase, then
 * calls `onChange` with the resulting public URL. Render it inside any form
 * (TanStack Form `AppField` or plain `useState`) — it only needs `value` +
 * `onChange`.
 */
export function ImageUpload({
  scope,
  value,
  onChange,
  label = "Image",
  accept = "image/png,image/jpeg,image/webp",
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Image must be 5MB or smaller");
      return;
    }

    setUploading(true);
    try {
      const signed = await signUpload(file.name, scope);
      if (!signed.success) {
        toast.error(signed.error);
        return;
      }

      const res = await fetch(signed.data.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) {
        toast.error("Upload failed");
        return;
      }

      onChange(signed.data.publicUrl);
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const open = () => inputRef.current?.click();

  return (
    <div className={className}>
      {value ? (
        <div className="relative inline-block">
          <Image
            src={value}
            alt={label}
            width={160}
            height={160}
            className="h-40 w-40 cursor-pointer rounded border border-border object-cover"
            unoptimized
            onClick={open}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            disabled={uploading}
            aria-label={`Remove ${label}`}
          >
            <X className="size-3" />
          </Button>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40">
              <Loader2 className="size-6 animate-spin text-white" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={uploading}
          className="flex h-40 w-40 cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-border text-muted-foreground transition-colors hover:border-sky-500 hover:text-sky-500 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          <span className="text-xs">{uploading ? "Uploading..." : label}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
