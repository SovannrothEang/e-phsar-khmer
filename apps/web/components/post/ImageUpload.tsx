import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Upload, X } from "lucide-react";
import { signUpload, type UploadSignFn } from "@/actions/files";
import { toast } from "@/components/ui/sonner";
import DbImage from "@/components/common/DbImage";
import {
  MAX_SOURCE_BYTES,
  UPLOAD_ACCEPT,
  resolveUploadMime,
} from "@/lib/upload";
import {
  IMMUTABLE_CACHE_CONTROL,
  prepareImageForUpload,
} from "@/lib/upload-image";

/**
 * Drag/drop + click photo picker. Signs a Supabase upload via a
 * `/files/sign` server action — admin session by default; pass
 * `signFn={signUploadUser}` for the user session — then uploads the bytes
 * directly to the signed URL. Reports the public URL through `onUploaded`
 * and/or the full `{ url, path }` pair through `onSigned` (the storage path
 * is required when creating a listing).
 *
 * The heading and cap come from the subcategory's own `field_schema` via the
 * post form: the jobs forms declare a single "Logo" slot (`max: 1`) while
 * every other photo-bearing form declares 8, so neither is a constant here.
 *
 * In edit mode `existing` carries the photos already on the listing: they are
 * shown first (the first one is the cover), count toward `max`, and removing
 * one only drops it from the payload — the backend deletes the object after a
 * successful save.
 */
export default function ImageUpload({
  images,
  onChange,
  onUploaded,
  signFn = signUpload,
  onSigned,
  existing,
  onRemoveExisting,
  onSignedRemoved,
  title = "Photos",
  max = 8,
}: {
  images: File[];
  onChange: (files: File[]) => void;
  onUploaded?: (url: string) => void;
  signFn?: UploadSignFn;
  onSigned?: (photo: { url: string; path: string }) => void;
  /** Photos already on the listing (edit mode), rendered before the new ones. */
  existing?: { url: string; path: string }[];
  onRemoveExisting?: (url: string) => void;
  /** A newly picked file removed again — drop its uploaded photo with it. */
  onSignedRemoved?: (photo: { url: string; path: string }) => void;
  /** Bold heading above the dropzone (the schema's `photos` label). */
  title?: string;
  /** How many photos this subcategory accepts (the schema's `photos.max`). */
  max?: number;
}) {
  const t = useTranslations("PostForm");
  const inputRef = useRef<HTMLInputElement>(null);
  // Files upload as soon as they are picked. Keep each signed pair so removing
  // the file before save also removes it from the submit payload — otherwise a
  // removed photo silently posts anyway.
  const signedByFile = useRef(new Map<File, { url: string; path: string }>());
  const existingPhotos = existing ?? [];
  const total = existingPhotos.length + images.length;

  const uploadOne = async (file: File) => {
    const mime = resolveUploadMime(file);
    if (!mime) return;
    // Cap the long side at 2560 px and re-encode to WebP where the browser can
    // — a listing card shows ~260 px and the hero ~760 px, so the original
    // 4000 px upload is detail nothing displays. The original is uploaded if
    // the browser cannot do it (never fail an upload over the optimizer).
    const prepared = await prepareImageForUpload(file);
    const signed = await signFn(prepared.file.name, "listing");
    if (!signed.success) {
      toast.error(signed.error);
      return;
    }
    const res = await fetch(signed.data.signedUrl, {
      method: "PUT",
      body: prepared.file,
      headers: {
        "Content-Type": prepared.mime,
        // Immutable object (UUID in the name): one year instead of the
        // one-hour default, so a repeat view is a cache hit.
        "Cache-Control": IMMUTABLE_CACHE_CONTROL,
      },
    });
    if (res.ok) {
      const photo = { url: signed.data.publicUrl, path: signed.data.path };
      signedByFile.current.set(file, photo);
      onUploaded?.(photo.url);
      onSigned?.(photo);
    } else toast.error(t("uploadFailed"));
  };

  const addFiles = (picked: File[]) => {
    if (picked.some((f) => resolveUploadMime(f) === null)) {
      toast.error(t("unsupportedType"));
    }
    if (picked.some((f) => f.size > MAX_SOURCE_BYTES)) {
      toast.error(t("fileTooLarge", { max: MAX_SOURCE_BYTES / (1024 * 1024) }));
    }
    const room = Math.max(0, max - total);
    const accepted = picked
      .filter(
        (f) => resolveUploadMime(f) !== null && f.size <= MAX_SOURCE_BYTES,
      )
      .slice(0, room);
    if (accepted.length === 0) return;
    onChange([...images, ...accepted]);
    void Promise.all(accepted.map(uploadOne));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
  };

  const remove = (i: number) => {
    const file = images[i];
    const signed = file ? signedByFile.current.get(file) : undefined;
    if (file) signedByFile.current.delete(file);
    if (signed) onSignedRemoved?.(signed);
    onChange(images.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="type-card-heading text-foreground">{title}</label>
        <span className="type-meta text-muted-foreground">
          {t("maxPhotos", { count: total, max })}
        </span>
      </div>

      {total > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {existingPhotos.map((photo, i) => (
            <div
              key={photo.url}
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group"
            >
              <DbImage
                src={photo.url}
                alt=""
                width={80}
                height={80}
                className="w-full h-full object-cover"
                fallback={<span className="block h-full w-full bg-muted" />}
              />
              {onRemoveExisting && (
                <button
                  type="button"
                  onClick={() => onRemoveExisting(photo.url)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-sm bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-[#00a0e9] text-white type-discount text-center py-0.5">
                  {t("cover")}
                </span>
              )}
            </div>
          ))}
          {images.map((f, i) => (
            <div
              key={i}
              className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- client-side object URL preview */}
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-sm bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
              {existingPhotos.length === 0 && i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-[#00a0e9] text-white type-discount text-center py-0.5">
                  {t("cover")}
                </span>
              )}
            </div>
          ))}
          {total < max && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-20 h-20 rounded-sm border-2 border-dashed border-muted flex items-center justify-center text-gray-400 hover:border-[#00a0e9] hover:text-[#00a0e9] transition-colors"
            >
              +
            </button>
          )}
        </div>
      )}

      {total === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-sm p-12 flex flex-col items-center gap-2 cursor-pointer hover:border-[#00a0e9] hover:bg-[#e1f3fb] transition-all"
        >
          <Upload className="w-10 h-10 text-[#00a0e9]" />
          <p className="type-body-sm text-gray-500">
            {t("dropTitle")}{" "}
            <span className="text-[#00a0e9] font-semibold underline">
              {t("browse")}
            </span>
          </p>
          <p className="type-meta text-gray-400">{t("supported")}</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
