import AboutProfile from "@/components/profile/About";
import { getLocale } from "next-intl/server";
import { listMyPhones } from "@/actions/settings";
import { resolvePlaceSelection } from "@/lib/api/categories";
import { placeDisplayName } from "@/lib/places";
import { getSettingsUser } from "@/lib/auth/current-user";
import { formatPhoneLocal } from "@/lib/phone";

export default async function AboutProfilePage() {
  // The (profile) layout already bounced a visitor; this keeps the types honest.
  const me = await getSettingsUser();
  if (!me) return null;
  const locale = await getLocale();

  const [phoneRows, place] = await Promise.all([
    listMyPhones(),
    resolvePlaceSelection(me.provinceId, me.districtId, me.communeId),
  ]);

  // Primary first, then the rest in the order the account saved them. The
  // active login number is not always in `user_phones` (a re-registered
  // account can have `primaryPhone` but no rows), so it is the fallback.
  const phones = [...phoneRows]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((p) => formatPhoneLocal(p.phone));
  if (phones.length === 0 && me.primaryPhone) {
    phones.push(formatPhoneLocal(me.primaryPhone));
  }

  // Most specific first, skipping levels the account never saved.
  const locations = [place.commune, place.district, place.province]
    .flatMap((p) => (p ? [placeDisplayName(p, locale)] : []))
    .join(", ");

  return (
    <AboutProfile
      user={{
        username: me.username ?? "",
        // The same rule `GET /users/by-username` uses for its public badge.
        verified: Boolean(me.phoneVerifiedAt || me.emailVerifiedAt),
        phone: [...new Set(phones)],
        email: me.email ?? undefined,
        userlink: me.username ? `@${me.username}` : undefined,
        locations,
      }}
    />
  );
}
