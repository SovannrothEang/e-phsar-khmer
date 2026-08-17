import type { Metadata } from "next";
import { OtpVerifyForm } from "@/components/auth/OtpVerifyForm";

export const metadata: Metadata = { title: "Verify Phone" };

export default async function OtpPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;
  return <OtpVerifyForm phone={phone ?? ""} />;
}
