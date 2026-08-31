"use server";

import { registerSchema } from "@/schemas/register";
import { normalizePhone } from "@/lib/phone";
import { API_URL } from "@/lib/api/client";
import z from "zod";

/**
 * Step 1 of phone registration: ask the backend to text an OTP to the phone.
 * The returned E.164 `phone` is what the OTP page must verify against.
 */
export async function register(
  unsafeData: z.infer<typeof registerSchema>,
): Promise<
  { success: true; phone: string } | { success: false; error?: string }
> {
  const data = registerSchema.safeParse(unsafeData);

  if (!data.success) return { success: false, error: "Invalid input" };

  const phone = normalizePhone(data.data.phoneNumber);
  if (!phone) return { success: false, error: "Invalid phone number" };

  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: { otpSent?: boolean };
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok || !body?.success || !body.data?.otpSent) {
    return {
      success: false,
      error: body?.error?.message ?? "Failed to send code",
    };
  }

  return { success: true, phone };
}
