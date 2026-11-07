"use server";

import {
  API_URL,
  ApiError,
  serverFetch,
  userServerFetch,
} from "@/lib/api/client";
import { getUserAccessToken, getUserRefreshToken } from "@/lib/auth/session";

export interface PublicReportReason {
  id: string;
  reason: string;
}

type ReportResult =
  | { success: true }
  | { success: false; error: string; code?: "AUTH" | "DUPLICATE" };

/** Admin-managed reasons for the report dialogs (public, fail-soft to []). */
export async function getPublicReportReasons(
  targetType: "user" | "listing",
): Promise<PublicReportReason[]> {
  try {
    const res = await fetch(
      `${API_URL}/reports/reasons?targetType=${targetType}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: PublicReportReason[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

/**
 * The viewer's token, without forcing them to sign up twice.
 *
 * A signed-in marketplace user reports as themselves — even when a dashboard
 * session also lives in this browser. A staff-only viewer (dashboard cookie,
 * no user session) reports with the admin token, which is a normal
 * authenticated account to the reports API. Only a visitor with neither
 * session gets the 401 that the dialogs turn into "Sign in to report".
 */
async function reportFetch<T>(path: string, init: RequestInit) {
  const [userAccess, userRefresh] = [
    await getUserAccessToken(),
    await getUserRefreshToken(),
  ];
  return userAccess || userRefresh
    ? userServerFetch<T>(path, init)
    : serverFetch<T>(path, init);
}

function toResult(err: unknown, fallback: string): ReportResult {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { success: false, error: "Sign in to report", code: "AUTH" };
    }
    if (err.status === 409) {
      return {
        success: false,
        error: "You have already reported this — it is being reviewed.",
        code: "DUPLICATE",
      };
    }
    return { success: false, error: err.message };
  }
  return { success: false, error: fallback };
}

export async function reportListing(input: {
  listingId: string;
  reasonId: string;
  description?: string;
}): Promise<ReportResult> {
  try {
    await reportFetch("/reports/listings", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { success: true };
  } catch (err) {
    return toResult(err, "Failed to send report");
  }
}

export async function reportUser(input: {
  targetUserId: string;
  reasonId: string;
  description?: string;
  imagePaths?: string[];
}): Promise<ReportResult> {
  try {
    await reportFetch("/reports/users", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { success: true };
  } catch (err) {
    return toResult(err, "Failed to send report");
  }
}
