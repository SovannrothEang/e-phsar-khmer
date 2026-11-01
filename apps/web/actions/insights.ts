"use server";

/**
 * Reads and writes for the Insight surface. `userServerFetch`, never
 * `serverFetch`: these are viewer-scoped (the summary must be the caller's
 * own listings), and the user client also sends no Authorization for an
 * anonymous visitor — which is exactly what the public tracking route needs.
 */

import { userServerFetch } from "@/lib/api/user-client";
import type { InsightEventInput, InsightSummary } from "@/types/insights";

/** Null on any failure so the page can render `—`, never false zeros. */
export async function loadInsightSummary(): Promise<InsightSummary | null> {
  try {
    const { data } = await userServerFetch<InsightSummary>("/insights/me");
    return data;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget ingestion. A tracking failure must never break a page, and
 * the endpoint is intentionally best-effort — no retries, no idempotency key.
 */
export async function trackInsightEvents(
  events: InsightEventInput[],
): Promise<void> {
  if (events.length === 0) return;

  try {
    await userServerFetch("/insights/events", {
      method: "POST",
      body: JSON.stringify({ events: events.slice(0, 50) }),
    });
  } catch {
    /* analytics are best-effort */
  }
}
