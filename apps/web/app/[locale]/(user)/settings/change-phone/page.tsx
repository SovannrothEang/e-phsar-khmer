import ChangePhone from "@/components/setting/Change-Phone";
import { getSettingsUser } from "@/lib/auth/current-user";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change Active Phone - Psakhmer",
  description: "Change Active Phone - Psakhmer",
};

export default async function ChangePhonePage() {
  const me = await getSettingsUser();
  return <ChangePhone me={me} />;
}
