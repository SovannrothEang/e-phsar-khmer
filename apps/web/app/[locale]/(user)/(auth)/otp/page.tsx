import { Suspense } from "react";
import type { Metadata } from "next";
import { OtpPageClient } from "@/components/auth/OtpPageClient";

export const metadata: Metadata = {
  title: "Verify your phone",
};

export default function OtpPage() {
  return (
    <Suspense>
      <OtpPageClient />
    </Suspense>
  );
}
