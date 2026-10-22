import Subscription from "@/components/profile/Subscription";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Me.metadata");
  return { title: t("subscriptions"), description: t("subscriptions") };
}

export default function SubscriptionsPage() {
  return <Subscription />;
}
