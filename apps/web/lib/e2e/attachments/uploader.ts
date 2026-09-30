import {
  completeChatAttachment,
  createChatAttachment,
} from "@/actions/chat-attachments";

/**
 * Upload seam (plan §5 step 4). V1 ships only DirectUploader: one signed PUT
 * per file. A resumable (TUS) implementation can slot in behind the same
 * interface once large files prove they need it.
 */
export interface AttachmentUploader {
  /** Idempotent: re-running with the same id after a failure is safe. */
  upload(input: {
    id: string;
    kind: "image" | "file";
    blob: ArrayBuffer;
  }): Promise<void>;
}

export class AttachmentUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const directUploader: AttachmentUploader = {
  async upload({ id, kind, blob }) {
    const ticket = await createChatAttachment({
      id,
      kind,
      declaredSize: blob.byteLength,
    });
    // ATTACHMENT_NOT_PENDING: a previous attempt already uploaded it (its
    // response got lost) — go straight to complete.
    if (!ticket.ok && ticket.code !== "ATTACHMENT_NOT_PENDING")
      throw new AttachmentUploadError(
        ticket.message,
        ticket.status,
        ticket.code,
      );

    if (ticket.ok) {
      const res = await fetch(ticket.data.uploadUrl, {
        method: "PUT",
        // The bucket only accepts octet-stream: the object is opaque ciphertext.
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      if (!res.ok) throw new AttachmentUploadError("Upload failed", res.status);
    }

    const done = await completeChatAttachment(id);
    if (!done.ok)
      throw new AttachmentUploadError(done.message, done.status, done.code);
  },
};
