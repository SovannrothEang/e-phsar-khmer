"use client";

import DbImage from "@/components/common/DbImage";
import { useTranslations } from "next-intl";
import type { SettingsUser } from "@/lib/auth/current-user";

/** "Sok Dara", falling back to the handle for an account with no name yet. */
export function displayName(me?: SettingsUser | null): string {
  const full = [me?.firstName, me?.lastName].filter(Boolean).join(" ");
  return full || me?.username || "";
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * The avatar + name + @handle block both settings layouts open with. The photo
 * is a DB value, so it renders through DbImage: anything that is not a storage
 * object (including "no photo at all") degrades to an initials circle, never a
 * bundled stand-in.
 */
export function AccountIdentity({ me }: { me?: SettingsUser | null }) {
  const t = useTranslations("Settings");
  const name = displayName(me);

  return (
    <div className="flex items-center gap-4 px-2">
      <DbImage
        src={me?.profilePhotoUrl ?? ""}
        width={100}
        height={100}
        alt={name || t("profilePicture")}
        className="rounded-full border border-gray-100 object-cover size-[50px] aspect-square flex-shrink-0"
        fallback={
          <span className="flex size-[50px] flex-shrink-0 items-center justify-center rounded-full border border-gray-100 bg-[#00a0e9] text-sm font-medium text-white">
            {initials(name)}
          </span>
        }
      />
      <div>
        {/* The card's link carries `group`; only the display name picks up
            the theme on hover — the @handle stays muted. */}
        <p className="font-medium text-foreground transition-colors group-hover:text-[#00a0e9]">
          {name}
        </p>
        <p className="text-sm text-muted-foreground">
          {me?.username ? `@${me.username}` : ""}
        </p>
      </div>
    </div>
  );
}
