import ChangeUsername from "@/components/setting/Change-Username";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change Username - Psakhmer",
  description: "Change Username - Psakhmer",
};
export default function ChangeUsernamePage() {
  return <ChangeUsername />;
}
