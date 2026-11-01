import BillingAddresses from "@/components/profile/Billing-Addresses";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Me.metadata");
  return {
    title: t("billingAddresses"),
    description: t("billingAddresses"),
  };
}
export default function BillingAddressesPage() {
  return <BillingAddresses />;
}
