"use server";

import { ApiError, serverFetch } from "@/lib/api/client";

export interface AdminFeedback {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  description: string;
  imagePaths: string[];
  /** Public URLs derived by the backend from `imagePaths`. */
  imageUrls: string[];
  createdAt: string;
}

export async function getFeedbacks(): Promise<AdminFeedback[]> {
  const { data } = await serverFetch<AdminFeedback[]>("/admin/feedback");
  return data;
}

export async function deleteFeedback(id: string) {
  try {
    await serverFetch(`/admin/feedback/${id}`, { method: "DELETE" });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof ApiError ? err.message : "Delete failed",
    };
  }
}
