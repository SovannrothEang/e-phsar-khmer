import BillingAddresses from "@/components/profile/Billing-Addresses";
import { getSettingsUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  // The strings already exist under `Me.metadata`; reusing them keeps this
  // page's title translated without a second copy in every locale file.
  const t = await getTranslations("Me.metadata");
  return {
    title: t("billingAddresses"),
    description: t("billingAddresses"),
  };
}
export default async function BillingAddressesPage() {
  const me = await getSettingsUser();
  return <BillingAddresses me={me} />;
}
