"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AccountIdentity } from "./AccountIdentity";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { SignOutDialog } from "./SignOutDialog";
import { formatPhoneLocal } from "@/lib/phone";
import type { SettingsUser } from "@/lib/auth/current-user";

/**
 * The settings rail every sub-page opens with. `me` is optional because the
 * billing-address components (client-side, out of this change's scope) render
 * the same rail without a profile — they get blank values rather than a
 * fabricated name.
 */
export default function SettingSidebar({ me }: { me?: SettingsUser | null }) {
  const t = useTranslations("Settings");
  const [autoUpdate, setAutoUpdate] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  /**
   * Active: theme text + a light theme tint and border. Inactive hover: the
   * existing neutral hover surface, but the label/chevron turn theme-colored.
   * The two columns therefore read differently even while hovered.
   */
  const rowClass = (href: string, rounding: string) =>
    cn(
      "group flex items-center justify-between border p-3 transition-colors",
      rounding,
      isActive(href)
        ? "border-[#00a0e9]/30 bg-[#00a0e9]/5 text-[#00a0e9] hover:bg-[#00a0e9]/10"
        : "border-transparent bg-card hover:border-border hover:bg-background/50 hover:text-[#00a0e9]",
    );

  const chevronClass = (href: string) =>
    cn(
      "transition-colors",
      isActive(href)
        ? "text-[#00a0e9]"
        : "text-gray-300 group-hover:text-[#00a0e9]",
    );

  return (
    <div className="min-h-screen bg-muted pb-10 ">
      <main className="max-w-md mx-auto">
        <Link
          href={{ pathname: "/settings/edit-profile" }}
          className="group flex items-center justify-between p-2 bg-card hover:bg-background/50 rounded-sm border border-transparent hover:border-border transition-colors"
        >
          <AccountIdentity me={me} />
          <ChevronRight
            size={24}
            className="text-gray-300 transition-colors group-hover:text-[#00a0e9]"
          />
        </Link>
        <div className="mt-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            {t("account")}
          </h3>
          <Link
            href={{ pathname: "/settings/edit-profile" }}
            className={rowClass("/settings/edit-profile", "rounded-t-sm")}
          >
            <p className="px-1">{t("editProfile")}</p>
            <p className="flex items-center gap-1">
              <ChevronRight
                size={24}
                className={chevronClass("/settings/edit-profile")}
              />
            </p>
          </Link>
          <Separator />
          <Link
            href={{ pathname: "/settings/change-password" }}
            className={rowClass("/settings/change-password", "rounded-none")}
          >
            <p className="px-1">{t("changePassword")}</p>
            <p className="flex items-center gap-1">
              <ChevronRight
                size={24}
                className={chevronClass("/settings/change-password")}
              />
            </p>
          </Link>
          <Separator />
          <Link
            href={{ pathname: "/settings/change-username" }}
            className={rowClass("/settings/change-username", "rounded-none")}
          >
            <p className="px-1">{t("username")}</p>
            <p className="flex items-center gap-1">
              <span className="text-foreground opacity-50">
                {me?.username ?? ""}
              </span>
              <ChevronRight
                size={24}
                className={chevronClass("/settings/change-username")}
              />
            </p>
          </Link>
          <Separator />
          <Link
            href={{ pathname: "/settings/change-phone" }}
            className={rowClass("/settings/change-phone", "rounded-none")}
          >
            <p className="px-1">{t("activatePhone")}</p>
            <p className="flex items-center gap-1">
              <span className="text-foreground opacity-50">
                {me?.primaryPhone ? formatPhoneLocal(me.primaryPhone) : "Add"}
              </span>
              <ChevronRight
                size={24}
                className={chevronClass("/settings/change-phone")}
              />
            </p>
          </Link>
          <Separator />
          {/* Connecting an identity needs a provider-linking flow the backend
              does not have yet, so these rows state the option and stop. */}
          <div className="group flex cursor-pointer items-center justify-between p-3 bg-card rounded-none border border-transparent transition-colors hover:border-border hover:bg-background/50 hover:text-[#00a0e9]">
            <p className="px-1">Facebook</p>
            <p className="flex items-center gap-1">
              <span className="text-foreground opacity-50 capitalize">
                {t("add")}
              </span>
              <ChevronRight
                size={24}
                className="text-gray-300 transition-colors group-hover:text-[#00a0e9]"
              />
            </p>
          </div>
          <Separator />
          <div className="group flex cursor-pointer items-center justify-between p-3 bg-card rounded-none border border-transparent transition-colors hover:border-border hover:bg-background/50 hover:text-[#00a0e9]">
            <p className="px-1">Google</p>
            <p className="flex items-center gap-1">
              <span className="text-foreground opacity-50 capitalize">
                {t("add")}
              </span>
              <ChevronRight
                size={24}
                className="text-gray-300 transition-colors group-hover:text-[#00a0e9]"
              />
            </p>
          </div>
          <Separator />
          <div className="group flex cursor-pointer items-center justify-between p-3 bg-card rounded-none border border-transparent transition-colors hover:border-border hover:bg-background/50 hover:text-[#00a0e9]">
            <p className="px-1">Telegram</p>
            <p className="flex items-center gap-1">
              <span className="text-foreground opacity-50 capitalize">
                {t("add")}
              </span>
              <ChevronRight
                size={24}
                className="text-gray-300 transition-colors group-hover:text-[#00a0e9]"
              />
            </p>
          </div>
          <Separator />
          <div className="group flex cursor-pointer items-center justify-between p-3 bg-card rounded-none border border-transparent transition-colors hover:border-border hover:bg-background/50 hover:text-[#00a0e9]">
            <p className="px-1">Apple</p>
            <p className="flex items-center gap-1">
              <span className="text-foreground opacity-50 capitalize">
                {t("add")}
              </span>
              <ChevronRight
                size={24}
                className="text-gray-300 transition-colors group-hover:text-[#00a0e9]"
              />
            </p>
          </div>
          <Separator />
          <Link
            href={{ pathname: "/settings/passkeys" }}
            className={rowClass("/settings/passkeys", "rounded-none")}
          >
            <p className="px-1">{t("passkeysRow")}</p>
            <p className="flex items-center capitalize gap-1">
              <ChevronRight
                size={24}
                className={chevronClass("/settings/passkeys")}
              />
            </p>
          </Link>
          <Separator />
          <Link
            href={{ pathname: "/settings/devices" }}
            className={rowClass("/settings/devices", "rounded-none")}
          >
            <p className="px-1">{t("devicesRow")}</p>
            <p className="flex items-center capitalize gap-1">
              <ChevronRight
                size={24}
                className={chevronClass("/settings/devices")}
              />
            </p>
          </Link>
          <Separator />
          <Field
            orientation="horizontal"
            onClick={() => {
              toast.promise<{ name: string }>(
                () =>
                  new Promise((resolve) =>
                    setTimeout(() => resolve({ name: t("storeName") }), 2000),
                  ),
                {
                  loading: t("loading"),
                  success: (data) => t("savedToast", { name: data.name }),
                  position: "top-right",
                  error: t("error"),
                },
              );
              setAutoUpdate(!autoUpdate);
            }}
            className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border cursor-pointer transition-colors"
          >
            <FieldLabel className="px-1 font-normal text-base cursor-pointer">
              {t("autoUpdate")}
            </FieldLabel>

            <Switch
              checked={autoUpdate}
              onCheckedChange={setAutoUpdate}
              className="data-[state=checked]:bg-[#00a0e9] data-[state=unchecked]:bg-input scale-120 mr-2"
            />
          </Field>
          <Separator />
          <DeleteAccountDialog
            username={me?.username ?? ""}
            trigger={
              <button className="w-full flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border cursor-pointer">
                <p className="px-1 ">{t("deleteAccountRow")}</p>
              </button>
            }
          />
          <Separator />
          <Link
            href={{ pathname: "/settings/privacy" }}
            className={rowClass("/settings/privacy", "rounded-none")}
          >
            <p className="px-1">{t("privacyRow")}</p>
            <p className="flex items-center gap-1">
              <ChevronRight
                size={24}
                className={chevronClass("/settings/privacy")}
              />
            </p>
          </Link>
          <Separator />
          <Link
            href={{ pathname: "/me/membership" }}
            className={rowClass("/me/membership", "rounded-none")}
          >
            <p className="px-1">{t("membership")}</p>
            <p className="flex items-center gap-1">
              <ChevronRight
                size={24}
                className={chevronClass("/me/membership")}
              />
            </p>
          </Link>
          <Separator />
          <Link
            href={{ pathname: "/me/billing-addresses" }}
            className={rowClass("/me/billing-addresses", "rounded-b-sm")}
          >
            <p className="px-1">{t("billingAddress")}</p>
            <p className="flex items-center gap-1">
              <ChevronRight
                size={24}
                className={chevronClass("/me/billing-addresses")}
              />
            </p>
          </Link>
          <div className="mt-2">
            <SignOutDialog
              trigger={
                <button className="flex w-full items-center justify-center p-1.5 bg-card hover:bg-red-700/90 rounded-full border border-transparent hover:border-red-500/20 group transition-colors">
                  <p className="text-red-500 font-medium group-hover:text-white">
                    {t("signOutButton")}
                  </p>
                </button>
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
