import AccountPrivacy from "@/components/setting/Privacy-Account";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Privacy - Psakhmer",
  description: "Account Privacy - Psakhmer",
};
export default function AccountPrivacyPage() {
  return <AccountPrivacy />;
}
