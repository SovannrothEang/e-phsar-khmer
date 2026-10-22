"use server";

/**
 * The public feedback form. Both calls go through `userServerFetch` so a
 * signed-in visitor's submission is stamped with their account id — the
 * backend route is `@Public()`, so an anonymous visitor works identically
 * (the fetch simply carries no bearer token).
 */

import { ApiError, userServerFetch } from "@/lib/api/client";
import type { SignUploadResponse } from "@/actions/files";

export interface FeedbackInput {
  name: string;
  phone: string;
  email?: string;
  description: string;
  imagePaths?: string[];
}

export interface FeedbackResult {
  success: boolean;
  error?: string;
}

/**
 * Signed upload URL for a feedback photo. `/files/sign` is JWT-only, so the
 * backend exposes a dedicated public (throttled) door under `/feedback`.
 */
export async function signFeedbackUpload(filename: string) {
  try {
    const { data } = await userServerFetch<SignUploadResponse>(
      "/feedback/attachments/sign",
      {
        method: "POST",
        body: JSON.stringify({ filename }),
      },
    );
    return { success: true as const, data };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof ApiError ? err.message : "Failed to sign upload",
    };
  }
}

/**
 * The global validation pipe collapses every DTO failure into this one
 * message, so the form cannot tell which field failed from it — the client
 * counters are the primary guard, this is the bypass fallback.
 */
const VALIDATION_FAILED = "Validation failed";

function describeSubmitError(err: unknown): string {
  if (!(err instanceof ApiError)) return "Failed to submit feedback";
  if (err.message === VALIDATION_FAILED)
    return "Please check your entries — one or more fields are too long or malformed.";
  return err.message;
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<FeedbackResult> {
  try {
    await userServerFetch("/feedback", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: describeSubmitError(err),
    };
  }
}
