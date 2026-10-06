import Setting from "@/components/setting/Setting";
import { getSettingsUser } from "@/lib/auth/current-user";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Settings - Psakhmer",
  description: "Account Settings - Psakhmer",
};
export default async function SettingsPage() {
  const me = await getSettingsUser();
  return <Setting me={me} />;
}
