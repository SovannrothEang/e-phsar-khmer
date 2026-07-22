import PasskeySettings from "@/components/setting/PasskeySettings"


import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Passkey Settings - Psakhmer",
    description: "Passkey Settings - Psakhmer",
};
export default function PasskeySettingsPage() {
    return (
        <PasskeySettings />
    )
}