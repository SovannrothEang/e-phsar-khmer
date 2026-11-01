import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { normalizePhone } from "@/lib/phone";
import { OtpVerifyForm } from "@/components/auth/OtpVerifyForm";

export const metadata: Metadata = {
  title: "Verify your phone",
};

/**
 * The phone travels in the URL (`/otp?phone=<E.164>`) and is read here on the
 * server, then handed to the form as a prop.
 *
 * Reading it with the client `useSearchParams()` forced a Suspense boundary,
 * and a boundary without a fallback renders an empty page segment: on a slow
 * navigation the footer rode up directly under the navbar until the payload
 * landed, then jumped down again when the card mounted.
 */
export default async function OtpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawPhone = (await searchParams).phone;
  const phone = normalizePhone(
    (Array.isArray(rawPhone) ? rawPhone[0] : rawPhone) ?? "",
  );
  if (!phone) return redirect({ href: "/register", locale: await getLocale() });

  return (
    <div className="container px-4 mx-auto my-6">
      <OtpVerifyForm phone={phone} />
    </div>
  );
}
