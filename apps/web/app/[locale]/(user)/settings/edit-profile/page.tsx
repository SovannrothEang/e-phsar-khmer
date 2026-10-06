import EditProfile from "@/components/setting/Edit-Profile";
import { getSettingsUser } from "@/lib/auth/current-user";
import { getProvinces, resolvePlaceSelection } from "@/lib/api/categories";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Profile - Psakhmer",
  description: "Edit Profile - Psakhmer",
};

export default async function EditProfilePage() {
  const me = await getSettingsUser();
  // The settings layout already bounced a visitor; this keeps the types honest.
  if (!me) return null;

  const provinces = await getProvinces();
  // The cascade lives in the URL params of the post form, but here it has to
  // come back from the stored ids — hence the walk down the geography tree.
  const savedPlace = await resolvePlaceSelection(
    me.provinceId,
    me.districtId,
    me.communeId,
  );

  return <EditProfile me={me} provinces={provinces} savedPlace={savedPlace} />;
}
