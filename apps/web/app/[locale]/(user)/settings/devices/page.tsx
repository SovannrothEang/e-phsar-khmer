import Devices from "@/components/setting/Devices";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings.metadata");
  return {
    title: t("devices"),
    description: t("devices"),
  };
}
export default function DevicesPage() {
  return <Devices />;
}
