import SavedAds from "@/components/profile/Saved-Ads";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Me.metadata");
  return { title: t("saved"), description: t("saved") };
}

export default function SavedProfile() {
  return (
    <div>
      <SavedAds />
    </div>
  );
}
