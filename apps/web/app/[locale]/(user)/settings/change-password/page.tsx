import ChangePassword from "@/components/setting/Change-Password";
import { getSettingsUser } from "@/lib/auth/current-user";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change Password - Psakhmer",
  description: "Change Password - Psakhmer",
};

export default async function ChangePasswordPage() {
  const me = await getSettingsUser();
  return <ChangePassword me={me} />;
}
