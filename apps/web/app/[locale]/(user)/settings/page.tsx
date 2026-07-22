import Setting from "@/components/setting/Setting"

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Account Settings - Psakhmer",
    description: "Account Settings - Psakhmer",
};
export default function SettingsPage() {
    return (
        <Setting />
    )
}