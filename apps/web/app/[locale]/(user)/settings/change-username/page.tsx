import ChangeUsername from "@/components/setting/Change-Username";
import { getSettingsUser } from "@/lib/auth/current-user";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Username - Psakhmer",
  description: "Edit Username - Psakhmer",
};

export default async function ChangeUsernamePage() {
  const me = await getSettingsUser();
  return <ChangeUsername me={me} />;
}
