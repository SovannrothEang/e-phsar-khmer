"use server";

import { ApiError, userServerFetch } from "@/lib/api/client";

export type ReportTargetType = "user" | "listing";

export interface ReportReasonOption {
  id: string;
  reason: string;
}

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reasonId: string;
  description?: string;
  imagePaths?: string[];
}

export type CreateReportResult =
  | { success: true }
  | { success: false; error: string; status?: number };

/**
 * Read the moderation picklist. Public on the backend (the dialogs must render
 * before a session exists), so this works for anonymous visitors too. Fails
 * soft to an empty list — the dialog renders "reasons unavailable" rather
 * than an error boundary.
 */
export async function loadReportReasons(
  targetType: ReportTargetType,
): Promise<ReportReasonOption[]> {
  try {
    const { data } = await userServerFetch<ReportReasonOption[]>(
      `/reports/reasons?targetType=${targetType}`,
    );
    return data;
  } catch {
    return [];
  }
}

/**
 * File a report. MUST use `userServerFetch`: the admin twin would submit every
 * visitor's report as the logged-in admin.
 */
export async function createReport(
  input: CreateReportInput,
): Promise<CreateReportResult> {
  try {
    await userServerFetch("/reports", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, error: err.message, status: err.status };
    }
    return { success: false, error: "Failed to submit the report" };
  }
}
