"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  EllipsisVertical,
  MapPin,
  MapPinHouse,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import SettingSidebar from "../setting/SettingSidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AddressFormDialog from "@/components/billing/AddressFormDialog";
import {
  deleteBillingAddress,
  getBillingAddresses,
  updateBillingAddress,
  type BillingAddress,
} from "@/actions/billing-addresses";
import type { SettingsUser } from "@/lib/auth/current-user";

/**
 * Settings surface for saved billing addresses. Same backend as the checkout's
 * picker — this is the manage-anytime view, that one is the pick-one view.
 *
 * `me` arrives from the settings page like `/settings/devices` does it: the
 * rail has to show the real identity, and a client-side read left it blank.
 */
export default function BillingAddresses({ me }: { me?: SettingsUser | null }) {
  const t = useTranslations("Me.billing");
  const [addresses, setAddresses] = useState<BillingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BillingAddress | null>(null);

  const reload = useCallback(() => {
    getBillingAddresses()
      .then(setAddresses)
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    getBillingAddresses()
      .then((items) => {
        if (mounted) setAddresses(items);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function setDefault(address: BillingAddress) {
    const result = await updateBillingAddress(address.id, { isDefault: true });
    if (!result.success) {
      toast.error(result.error ?? "Could not update the address");
      return;
    }
    reload();
  }

  async function remove(address: BillingAddress) {
    const result = await deleteBillingAddress(address.id);
    if (!result.success) {
      toast.error(result.error ?? "Could not delete the address");
      return;
    }
    reload();
  }

  const defaultName =
    [me?.firstName, me?.lastName].filter(Boolean).join(" ").trim() ||
    me?.username ||
    "";

  return (
    <div className="min-h-screen bg-muted pb-10 pt-4">
      {/* The settings shell, identical to `/settings/devices` and the rest of
          the settings family: `max-w-6xl` with the rail on the left. */}
      <div className="mx-auto max-w-6xl">
        <div className="flex gap-5">
          <SettingSidebar me={me} />
          <main className="flex-1">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h1 className="type-page-title text-foreground">{t("title")}</h1>
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="h-10 rounded-sm bg-orange-500 px-5 font-medium text-white hover:bg-orange-600"
              >
                <Plus className="mr-1 h-4 w-4" /> {t("addAddress")}
              </Button>
            </div>

            {loading ? (
              <div className="h-64 animate-pulse rounded-sm border bg-card" />
            ) : addresses.length === 0 ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center rounded-sm border bg-card p-8">
                <div className="mb-6 flex h-36 w-36 items-center justify-center rounded-full bg-muted">
                  <MapPinHouse
                    size={64}
                    className="text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="mb-8 space-y-2 text-center">
                  <h2 className="type-section-title text-foreground">
                    {t("noAddress")}
                  </h2>
                  <p className="type-body-sm text-muted-foreground">
                    {t("noAddressHint")}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                  className="h-10 rounded-sm bg-[#f68b1e] px-10 font-medium text-white transition-colors hover:bg-[#e57a10]"
                >
                  {t("addAddress")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <article
                    key={address.id}
                    className="flex items-start gap-4 rounded-sm border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">
                          {address.label}
                        </h2>
                        {address.isDefault && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-sm text-foreground">
                        <p className="flex items-center gap-2">
                          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {address.name}
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                          {address.phone}
                        </p>
                        <p className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span>
                            {address.address}
                            {address.company && (
                              <span className="block text-muted-foreground">
                                {address.company}
                              </span>
                            )}
                          </span>
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Address actions"
                          className="rounded-sm p-1 text-muted-foreground hover:bg-muted"
                        >
                          <EllipsisVertical className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(address);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={address.isDefault}
                          onClick={() => void setDefault(address)}
                        >
                          Set as default
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => void remove(address)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <AddressFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        defaultName={defaultName}
        defaultPhone={me?.primaryPhone ?? ""}
        onSaved={reload}
      />
    </div>
  );
}
