"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { normalizePhone } from "@/lib/phone";
import { OtpVerifyForm } from "@/components/auth/OtpVerifyForm";

/**
 * Client shim for the OTP page: reads the phone from the URL (the register
 * step navigates here with `?phone=<E.164>`), validates it, and bounces back
 * to register when it is missing or not a plausible number.
 */
export function OtpPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = normalizePhone(searchParams.get("phone") ?? "");

  useEffect(() => {
    if (!phone) router.replace("/register");
  }, [phone, router]);

  if (!phone) return null;

  return (
    <div className="container px-4 mx-auto my-6 pb-30">
      <OtpVerifyForm phone={phone} />
    </div>
  );
}
