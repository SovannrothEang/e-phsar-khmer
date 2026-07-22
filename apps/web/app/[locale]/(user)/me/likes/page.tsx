import LikedAds from "@/components/profile/Liked-Ads"

import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Liked Ads - Psakhmer",
    description: "Liked Ads",
};

export default function SavedProfile() {
    return (
       <LikedAds />
    )
}