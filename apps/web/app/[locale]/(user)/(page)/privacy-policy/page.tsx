import PrivacyPolicy from "@/components/page/Privacy-Policy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Psakhmer",
  description: "Privacy Policy - Psakhmer",
};
export default function PrivacyPolicyPage() {
  return <PrivacyPolicy />;
}
