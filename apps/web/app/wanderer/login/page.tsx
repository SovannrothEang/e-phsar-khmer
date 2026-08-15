import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Admin login",
};

export default function WandererLoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-md">
        <AdminLoginForm />
      </div>
    </div>
  );
}
