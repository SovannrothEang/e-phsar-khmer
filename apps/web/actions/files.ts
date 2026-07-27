"use server";

import { ApiError, serverFetch } from "@/lib/api/client";

/**
 * Upload scopes accepted by the backend `POST /files/sign` endpoint. Each scope
 * maps to a top-level folder in the shared `listings` Supabase bucket (chat is
 * additionally namespaced per user).
 */
export type UploadScope =
  | "avatar"
  | "cover"
  | "listing"
  | "chat"
  | "category"
  | "subcategory"
  | "brand"
  | "model"
  | "attribute";

interface SignUploadResponse {
  signedUrl: string;
  path: string;
  token: string;
  publicUrl: string;
}

/**
 * Request a Supabase signed upload URL for a file. The client then PUTs the
 * bytes directly to the signed URL and persists the returned `publicUrl`.
 */
export async function signUpload(filename: string, scope: UploadScope) {
  try {
    const { data } = await serverFetch<SignUploadResponse>("/files/sign", {
      method: "POST",
      body: JSON.stringify({ filename, scope }),
    });
    return { success: true as const, data };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof ApiError ? err.message : "Failed to sign upload",
    };
  }
}
