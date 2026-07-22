import BillingAddresses from "@/components/profile/Billing-Addresses"


import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Billing Address - Psakhmer",
    description: "Billing Address - Psakhmer",
};
export default function BillingAddressesPage() {
    return (
        <BillingAddresses />
    )
}