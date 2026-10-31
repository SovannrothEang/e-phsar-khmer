import AccountPrivacy from "@/components/setting/Privacy-Account";
import { getSettingsUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings.metadata");
  return {
    title: t("privacy"),
    description: t("privacy"),
  };
}

export default async function PrivacyPage() {
  const me = await getSettingsUser();
  // The settings layout already bounced a visitor; this keeps the types honest.
  if (!me) return null;
  return <AccountPrivacy me={me} />;
}
