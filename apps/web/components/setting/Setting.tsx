"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/routing";
import { ChevronRight } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AccountIdentity } from "./AccountIdentity";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { SignOutDialog } from "./SignOutDialog";
import { formatPhoneLocal } from "@/lib/phone";
import type { SettingsUser } from "@/lib/auth/current-user";

/** The settings hub: a full-width list of account rows. */
export default function Settings({ me }: { me?: SettingsUser | null }) {
  const t = useTranslations("Settings");
  const [autoUpdate, setAutoUpdate] = useState(false);
  return (
    <div className="min-h-screen bg-muted pb-30 pt-2">
      <div className="max-w-6xl mx-auto px-4 ">
        <main className="max-w-4xl mx-auto px-4">
          <h1 className="text-2xl font-medium text-foreground mb-4 mt-2">
            {t("title")}
          </h1>

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
          <div className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {t("account")}
            </h3>
            <Link
              href={{ pathname: "/settings/edit-profile" }}
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-t-lg border border-transparent hover:border-border"
            >
              <p className="px-1">{t("editProfile")}</p>
              <p className="flex items-center opacity-50 gap-1">
                <ChevronRight size={24} className="text-gray-300" />
              </p>
            </Link>
            <Separator />
            <Link
              href={{ pathname: "/settings/change-password" }}
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
            >
              <p className="px-1">{t("changePassword")}</p>
              <p className="flex items-center opacity-50 gap-1">
                <ChevronRight size={24} className="text-gray-300" />
              </p>
            </Link>
            <Separator />
            <Link
              href={{ pathname: "/settings/change-username" }}
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
            >
              <p className="px-1">{t("username")}</p>
              <p className="flex items-center opacity-50 gap-1">
                {me?.username ?? ""}
                <ChevronRight size={24} className="text-gray-300" />
              </p>
            </Link>
            <Separator />
            <Link
              href={{ pathname: "/settings/change-phone" }}
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
            >
              <p className="px-1">{t("activatePhone")}</p>
              <p className="flex items-center opacity-50 gap-1">
                {me?.primaryPhone ? formatPhoneLocal(me.primaryPhone) : "Add"}
                <ChevronRight size={24} className="text-gray-300" />
              </p>
            </Link>
            <Separator />
            {/* Connecting an identity needs a provider-linking flow the
                backend does not have yet, so these rows state the option and
                stop — no chevron, nothing to click. */}
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
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
            >
              <p className="px-1">{t("passkeysRow")}</p>
              <p className="flex items-center opacity-50 capitalize gap-1">
                <ChevronRight size={24} className="text-gray-300" />
              </p>
            </Link>
            <Separator />
            <Link
              href={{ pathname: "/settings/devices" }}
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
            >
              <p className="px-1">{t("devicesRow")}</p>
              <p className="flex items-center opacity-50 capitalize gap-1">
                <ChevronRight size={24} className="text-gray-300" />
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
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
            >
              <p className="px-1">{t("privacyRow")}</p>
              <p className="flex items-center opacity-50 gap-1">
                <ChevronRight size={24} className="text-gray-300" />
              </p>
            </Link>
            <Separator />
            <Link
              href={{ pathname: "/me/membership" }}
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-none border border-transparent hover:border-border"
            >
              <p className="px-1">{t("membership")}</p>
              <p className="flex items-center opacity-50 gap-1">
                <ChevronRight size={24} className="text-gray-300" />
              </p>
            </Link>
            <Separator />
            <Link
              href={{ pathname: "/me/billing-addresses" }}
              className="flex items-center justify-between p-3 bg-card hover:bg-background/50 rounded-b-lg border border-transparent hover:border-border"
            >
              <p className="px-1">{t("billingAddress")}</p>
              <p className="flex items-center opacity-50 gap-1">
                <ChevronRight size={24} className="text-gray-300" />
              </p>
            </Link>
            <div className="mt-4">
              <SignOutDialog
                trigger={
                  <button className="flex w-full items-center justify-center p-2.5 h-10 bg-card hover:bg-red-700/90 rounded-full border border-transparent hover:border-red-500/20 group transition-colors cursor-pointer">
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
    </div>
  );
}
