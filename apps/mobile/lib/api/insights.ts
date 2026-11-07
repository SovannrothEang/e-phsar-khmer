import { apiFetch } from "@/lib/api/client";

/** `GET /insights/me` — all-time interaction totals for my listings. */
export interface InsightSummary {
  impression: number;
  engagement: number;
  view: number;
  chat: number;
  call: number;
  showContact: number;
  applyJob: number;
}

export async function fetchMyInsights(): Promise<InsightSummary | null> {
  const { data } = await apiFetch<InsightSummary>("/insights/me");
  return data ?? null;
}
