import Devices from "@/components/setting/Devices"

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Manage Devices - Psakhmer",
    description: "Manage Devices - Psakhmer",
};
export default function DevicesPage() {
    return (
        <Devices />
    )
}