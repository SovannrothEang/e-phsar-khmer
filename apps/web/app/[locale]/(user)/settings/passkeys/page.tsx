import PasskeySettings from "@/components/setting/PasskeySettings";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings.metadata");
  return {
    title: t("passkeys"),
    description: t("passkeys"),
  };
}
export default function PasskeySettingsPage() {
  return <PasskeySettings />;
}
