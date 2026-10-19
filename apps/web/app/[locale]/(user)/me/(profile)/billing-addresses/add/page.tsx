import AddAddress from "@/components/profile/Add-Address";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Address - Psakhmer",
  description: "Add Address - Psakhmer",
};
export default function AddAddressPage() {
  return <AddAddress />;
}
