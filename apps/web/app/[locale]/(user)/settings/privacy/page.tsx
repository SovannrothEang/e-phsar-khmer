import AccountPrivacy from "@/components/setting/Privacy-Account";
import { getSettingsUser } from "@/lib/auth/current-user";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy - Psakhmer",
  description: "Privacy - Psakhmer",
};

export default async function PrivacyPage() {
  // The visibility toggles are still a mock — only the rail reads the profile.
  const me = await getSettingsUser();
  return <AccountPrivacy me={me} />;
}
