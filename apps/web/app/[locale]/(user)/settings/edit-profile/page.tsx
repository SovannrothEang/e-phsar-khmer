import EditProfile from "@/components/setting/Edit-Profile"

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Edit Account Profile - Psakhmer",
    description: "Edit Account Profile - Psakhmer",
};
export default function EditProfilePage() {
    return (
        <EditProfile />
    )
}