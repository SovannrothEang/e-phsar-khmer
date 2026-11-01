import { apiFetch } from "@/lib/api/client";

export type ReportTargetType = "listing" | "user";

export interface ReportReason {
  id: string;
  reason: string;
}

/** Active reasons for one target type, ordered by the admin picklist. */
export async function fetchReportReasons(
  targetType: ReportTargetType,
): Promise<ReportReason[]> {
  const { data } = await apiFetch<ReportReason[]>(
    `/reports/reasons?targetType=${targetType}`,
    { auth: false },
  );
  return data ?? [];
}

export async function reportListing(input: {
  listingId: string;
  reasonId: string;
  description?: string;
}): Promise<unknown> {
  const { data } = await apiFetch<unknown>("/reports/listings", {
    method: "POST",
    body: input,
  });
  return data;
}

export async function reportUser(input: {
  targetUserId: string;
  reasonId: string;
  description?: string;
  imagePaths?: string[];
}): Promise<unknown> {
  const { data } = await apiFetch<unknown>("/reports/users", {
    method: "POST",
    body: input,
  });
  return data;
}
