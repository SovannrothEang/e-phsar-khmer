import Setting from "@/components/setting/Setting";
import { getSettingsUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings.metadata");
  return {
    title: t("settings"),
    description: t("settings"),
  };
}
export default async function SettingsPage() {
  const me = await getSettingsUser();
  return <Setting me={me} />;
}
