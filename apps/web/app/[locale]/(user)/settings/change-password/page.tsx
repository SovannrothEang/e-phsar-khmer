import ChangePassword from "@/components/setting/Change-Password";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Change Password - Psakhmer",
  description: "Change Password",
};
export default function ChangePasswordPage() {
  return <ChangePassword />;
}
