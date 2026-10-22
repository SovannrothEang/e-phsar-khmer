import ChangePhone from "@/components/setting/Change-Phone";
import { getSettingsUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings.metadata");
  return {
    title: t("changePhone"),
    description: t("changePhone"),
  };
}

export default async function ChangePhonePage() {
  const me = await getSettingsUser();
  return <ChangePhone me={me} />;
}
