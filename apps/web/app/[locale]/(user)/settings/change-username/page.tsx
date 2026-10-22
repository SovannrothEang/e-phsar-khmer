import ChangeUsername from "@/components/setting/Change-Username";
import { getSettingsUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings.metadata");
  return {
    title: t("changeUsername"),
    description: t("changeUsername"),
  };
}

export default async function ChangeUsernamePage() {
  const me = await getSettingsUser();
  return <ChangeUsername me={me} />;
}
