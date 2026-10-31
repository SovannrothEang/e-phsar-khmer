import EditProfile from "@/components/setting/Edit-Profile";
import { getSettingsUser } from "@/lib/auth/current-user";
import { getProvinces, resolvePlaceSelection } from "@/lib/api/categories";
import { listMyPhones } from "@/actions/settings";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings.metadata");
  return {
    title: t("editProfile"),
    description: t("editProfile"),
  };
}

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
  // Secondary contact numbers; the primary row falls back to `me.primaryPhone`
  // when the account has no phone rows at all.
  const phones = await listMyPhones();

  return (
    <EditProfile
      me={me}
      provinces={provinces}
      savedPlace={savedPlace}
      phones={phones}
    />
  );
}
