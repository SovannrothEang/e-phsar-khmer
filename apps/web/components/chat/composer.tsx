"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Camera,
  Loader2,
  Lock,
  MapPin,
  Mic,
  Pause,
  Play,
  Plus,
  SendHorizonal,
  Square,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { storeDraftImage, removeDraftImage } from "@/lib/chat-draft-images";

export interface ComposerDraft {
  body?: string;
  /** Draft-image registry keys — uploaded to Supabase on send. */
  draftKeys?: string[];
  /** Shared position; the caller seals it inside the encrypted body. */
  location?: { latitude: number; longitude: number; accuracyMeters?: number };
  /** Recorded voice note; the caller encrypts and uploads it as an attachment. */
  voice?: { file: File; durationMs: number };
}

interface StagedImage {
  key: string;
  previewUrl: string;
}

interface StagedVoice {
  file: File;
  durationMs: number;
  previewUrl: string;
}

type StagedLocation = NonNullable<ComposerDraft["location"]>;

// Mirrors the backend FilesService image validation (5MB).
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Mirrors the v2 attachment caps the send path enforces.
const MAX_VOICE_BYTES = 8 * 1024 * 1024;
const MAX_VOICE_MS = 60_000;
// A tap that starts and stops in the same breath is not a voice note.
const MIN_VOICE_MS = 300;
// Most-preferred first — Opus in WebM is the smallest container we can encode.
const VOICE_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const ICON_BUTTON_CLASS =
  "shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";

function voiceExtension(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [text, setText] = useState("");
  const [staged, setStaged] = useState<StagedImage[]>([]);
  const [location, setLocation] = useState<StagedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [voice, setVoice] = useState<StagedVoice | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  // Guards the get-user-media prompt so a double tap cannot open it twice.
  const startingRef = useRef(false);
  const elapsedTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const voiceUrlRef = useRef<string | null>(null);
  // Cleared on unmount so a late recorder callback never touches React state.
  const aliveRef = useRef(true);
  // Read inside async callbacks that outlive the render they started in.
  const disabledRef = useRef(disabled);

  const maxAllowed = hasListing ? MAX_IMAGES - 1 : MAX_IMAGES;
  const remaining = maxAllowed - staged.length;
  const hasContent =
    text.trim() !== "" ||
    staged.length > 0 ||
    location !== null ||
    voice !== null;
  const canSend = !disabled && !sending && !recording && hasContent;
  // Stay mounted while a send is in flight: submit clears the draft, and the
  // button must not disappear out from under the spinner.
  const showSend = hasContent || sending;

  // Release unsent drafts when the composer unmounts (e.g. switching threads).
  // Sent drafts are no longer in `staged`; the send path cleans those up.
  const stagedRef = useRef(staged);
  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearRecordingTimers = useCallback(() => {
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const discardVoice = useCallback(() => {
    audioRef.current?.pause();
    if (voiceUrlRef.current) {
      URL.revokeObjectURL(voiceUrlRef.current);
      voiceUrlRef.current = null;
    }
    setPreviewPlaying(false);
    setVoice(null);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {
            // Already stopping; nothing left to release.
          }
        }
        recorderRef.current = null;
      }
      chunksRef.current = [];
      clearRecordingTimers();
      releaseStream();
      if (voiceUrlRef.current) {
        URL.revokeObjectURL(voiceUrlRef.current);
        voiceUrlRef.current = null;
      }
      stagedRef.current.forEach((item) => removeDraftImage(item.key));
    };
  }, [clearRecordingTimers, releaseStream]);

  // Being blocked mid-recording must not leave the microphone open behind the
  // lock banner: stop for real and let `onstop` tear the rest down.
  useEffect(() => {
    if (!disabled) return;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    try {
      recorder.stop();
    } catch {
      // Already stopping.
    }
  }, [disabled]);

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      return;
    }
    try {
      recorder.stop();
    } catch {
      // The recorder already transitioned; its onstop handler still runs.
    }
  }

  async function startRecording() {
    if (startingRef.current || recorderRef.current) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error(t("composer.voiceUnsupported"));
      return;
    }
    const mimeType = VOICE_MIME_CANDIDATES.find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    if (!mimeType) {
      toast.error(t("composer.voiceUnsupported"));
      return;
    }

    startingRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      startingRef.current = false;
      const name = error instanceof DOMException ? error.name : "";
      toast.error(
        name === "NotAllowedError" || name === "SecurityError"
          ? t("composer.voicePermissionError")
          : t("composer.voiceUnsupported"),
      );
      return;
    }
    startingRef.current = false;

    // The composer may have unmounted or been blocked while the permission
    // prompt was open; never start a recorder nobody can stop.
    if (!aliveRef.current || disabledRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    streamRef.current = stream;
    chunksRef.current = [];
    startedAtRef.current = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const rawDuration = Date.now() - startedAtRef.current;
      const durationMs = Math.min(MAX_VOICE_MS, rawDuration);
      clearRecordingTimers();
      releaseStream();
      recorderRef.current = null;
      setRecording(false);
      setElapsedMs(0);

      const chunks = chunksRef.current;
      chunksRef.current = [];
      // A thread that became unavailable mid-recording must not stage a note
      // the user can never see or send.
      if (!aliveRef.current || disabledRef.current) return;

      const type = recorder.mimeType || mimeType;
      const blob = new Blob(chunks, { type });
      // Too short to be a note (a stray tap), or the container never got data.
      if (blob.size === 0 || rawDuration < MIN_VOICE_MS) return;
      // The auto-stop fires at the cap; the 1s tolerance absorbs timer lag.
      if (rawDuration > MAX_VOICE_MS + 1_000 || blob.size > MAX_VOICE_BYTES) {
        toast.error(t("composer.voiceTooLong", { seconds: 60 }));
        return;
      }

      // Replace any earlier take, releasing the audio element's old URL.
      audioRef.current?.pause();
      if (voiceUrlRef.current) URL.revokeObjectURL(voiceUrlRef.current);
      const file = new File([blob], `voice-note.${voiceExtension(type)}`, {
        type,
      });
      const previewUrl = URL.createObjectURL(file);
      voiceUrlRef.current = previewUrl;
      setPreviewPlaying(false);
      setVoice({ file, durationMs, previewUrl });
    };
    recorder.start();

    setElapsedMs(0);
    setRecording(true);
    elapsedTimerRef.current = window.setInterval(() => {
      setElapsedMs(Math.min(MAX_VOICE_MS, Date.now() - startedAtRef.current));
    }, 200);
    maxTimerRef.current = window.setTimeout(stopRecording, MAX_VOICE_MS);
    onActivity?.();
  }

  function toggleRecording() {
    if (recording) stopRecording();
    else void startRecording();
  }

  function requestLocation() {
    if (locating) return;
    // Only ever ask after an explicit click — a permission prompt on mount is
    // hostile, and most threads never share a position.
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("composer.locationUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!aliveRef.current) return;
        setLocating(false);
        const accuracy = position.coords.accuracy;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          ...(Number.isFinite(accuracy) ? { accuracyMeters: accuracy } : {}),
        });
        toast.success(t("composer.locationReady"));
        onActivity?.();
      },
      () => {
        if (!aliveRef.current) return;
        setLocating(false);
        toast.error(t("composer.locationError"));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  const togglePreview = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (audio.ended) audio.currentTime = 0;
      void audio.play().catch(() => setPreviewPlaying(false));
    } else {
      audio.pause();
    }
  }, []);

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

  const submit = useCallback(() => {
    if (!canSend) return;
    onSend({
      body: text.trim() || undefined,
      draftKeys: staged.map((item) => item.key),
      location: location ?? undefined,
      voice: voice
        ? { file: voice.file, durationMs: voice.durationMs }
        : undefined,
    });
    // Detach the registry keys before clearing state: the caller keeps reading
    // the draft files while it uploads, so the unmount cleanup must not release
    // them in the same tick.
    stagedRef.current = [];
    setText("");
    setStaged([]);
    setLocation(null);
    discardVoice();
    onActivity?.();
  }, [
    canSend,
    text,
    staged,
    location,
    voice,
    onSend,
    onActivity,
    discardVoice,
  ]);

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
      {recording && (
        <div
          role="status"
          className="flex items-center gap-2 px-4 pt-2.5 text-xs font-medium text-destructive sm:px-3"
        >
          <span className="size-2 animate-pulse rounded-full bg-destructive" />
          <span>{t("composer.recording")}</span>
          <span aria-hidden="true" className="tabular-nums">
            {formatDuration(elapsedMs)}
          </span>
        </div>
      )}

      <div className="flex items-center gap-0.5 px-2 py-2 sm:px-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || remaining <= 0}
          aria-label={t("composer.attachImage")}
          className={ICON_BUTTON_CLASS}
        >
          <Plus className="size-[18px]" />
        </button>

        <button
          type="button"
          onClick={requestLocation}
          disabled={sending || locating}
          aria-label={
            locating
              ? t("composer.locationLocating")
              : t("composer.shareLocation")
          }
          className={ICON_BUTTON_CLASS}
        >
          {locating ? (
            <Loader2 className="size-[18px] animate-spin" />
          ) : (
            <MapPin className="size-[18px]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={sending || remaining <= 0}
          aria-label={t("composer.attachImage")}
          className={ICON_BUTTON_CLASS}
        >
          <Camera className="size-[18px]" />
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
          className="mx-1 h-10 max-h-24 min-w-0 flex-1 resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded-2xl border-none bg-muted px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          onKeyDown={(e) => {
            // Never swallow an IME composition commit (Khmer input).
            if (e.nativeEvent.isComposing) return;
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

        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            aria-pressed={recording}
            aria-label={t("composer.stopRecording")}
            className="shrink-0 rounded-full bg-destructive/15 p-2 text-destructive transition-colors hover:bg-destructive/25"
          >
            <Square className="size-[18px] fill-current" />
          </button>
        ) : showSend ? (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label={t("composer.send")}
            className={cn(
              "shrink-0 rounded-full p-2 transition-colors",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground/50",
            )}
          >
            {sending ? (
              <Loader2 className="size-[18px] animate-spin" />
            ) : (
              <SendHorizonal className="size-[18px]" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleRecording}
            disabled={sending}
            aria-pressed={recording}
            aria-label={t("composer.recordVoice")}
            className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Mic className="size-[18px]" />
          </button>
        )}
      </div>

      {(staged.length > 0 || location !== null || voice !== null) && (
        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2.5">
          {staged.map((item, index) => (
            <div
              key={item.key}
              className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border"
            >
              <Image
                src={item.previewUrl}
                alt={t("composer.stagedImageAlt")}
                fill
                sizes="56px"
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={() => discardStaged(index)}
                aria-label={t("composer.removeImage")}
                className="absolute right-0.5 top-0.5 rounded-full border border-border bg-background/80 p-0.5 text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          {location && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pl-2.5 pr-1">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs tabular-nums text-foreground">
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </span>
              {location.accuracyMeters !== undefined && (
                <span className="text-[10px] text-muted-foreground">
                  ±{Math.round(location.accuracyMeters)}m
                </span>
              )}
              <button
                type="button"
                onClick={() => setLocation(null)}
                aria-label={t("composer.cancelLocation")}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          {voice && (
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pl-1 pr-1">
              <button
                type="button"
                onClick={togglePreview}
                aria-pressed={previewPlaying}
                className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-foreground transition-colors hover:bg-background"
              >
                {previewPlaying ? (
                  <Pause className="size-3 fill-current" />
                ) : (
                  <Play className="size-3 fill-current" />
                )}
                <span className="text-xs tabular-nums">
                  {formatDuration(voice.durationMs)}
                </span>
                <span className="sr-only">{t("composer.voiceReady")}</span>
              </button>
              <button
                type="button"
                onClick={discardVoice}
                aria-label={t("composer.cancelVoice")}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          )}

          {staged.length > 0 && (
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums",
                remaining <= 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {staged.length}/{maxAllowed}
            </span>
          )}
        </div>
      )}

      {voice && (
        <audio
          ref={audioRef}
          src={voice.previewUrl}
          preload="metadata"
          onPlay={() => setPreviewPlaying(true)}
          onPause={() => setPreviewPlaying(false)}
          onEnded={() => setPreviewPlaying(false)}
          className="hidden"
        />
      )}

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

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
