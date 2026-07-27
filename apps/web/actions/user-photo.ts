"use server";

import { ApiError, serverFetch } from "@/lib/api/client";

/**
 * Subset of the backend `PublicUser` — only the fields we need after an upload.
 * The backend `POST /users/me/avatar` and `/users/me/cover` endpoints upload to
 * Supabase and immediately persist the new URL, returning the updated user.
 */
interface UploadPhotoResponse {
  id: string;
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
}

/**
 * Upload an avatar or cover photo for the current user via the backend's
 * multipart endpoints. Sends `FormData` so the browser sets the multipart
 * boundary (see `rawFetch` in lib/api/client.ts).
 */
export async function uploadUserPhoto(kind: "avatar" | "cover", file: File) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const { data } = await serverFetch<UploadPhotoResponse>(
      `/users/me/${kind}`,
      { method: "POST", body: formData },
    );
    return { success: true as const, data };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof ApiError ? err.message : "Failed to upload photo",
    };
  }
}
