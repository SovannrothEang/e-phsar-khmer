import SavedAds from "@/components/profile/Saved-Ads"

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Ads - Psakhmer",
  description: "Saved Ads",
};

export default function SavedProfile() {
    return (
        <div>
            <SavedAds />
        </div>
    )
}