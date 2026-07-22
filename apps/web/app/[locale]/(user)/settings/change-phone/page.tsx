import ChangePhone from "@/components/setting/Change-Phone"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change Phone - Psakhmer",
  description: "Change Phone",
};
export default function ChangePhonePage() {
    return (
        <ChangePhone />
    )
}