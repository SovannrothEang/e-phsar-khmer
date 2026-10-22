import LikedAds from "@/components/profile/Liked-Ads";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Me.metadata");
  return { title: t("likes"), description: t("likes") };
}

export default function SavedProfile() {
  return <LikedAds />;
}
