import AccountDeletion from "@/components/page/Account-Deletion";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Deletion - Psakhmer",
  description: "Account Deletion",
};

export default function AccountDeletionPage() {
  return <AccountDeletion />;
}
