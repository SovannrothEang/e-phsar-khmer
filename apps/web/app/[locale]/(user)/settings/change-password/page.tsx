import ChangePassword from "@/components/setting/Change-Password";
import { getSettingsUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings.metadata");
  return {
    title: t("changePassword"),
    description: t("changePassword"),
  };
}

export default async function ChangePasswordPage() {
  const me = await getSettingsUser();
  return <ChangePassword me={me} />;
}
