import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getCurrentUser } from "@/actions/user";
import { redirect } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // Defense in depth: the admin login gate already blocks non-admins, and
  // the backend 403s on every /admin call, but this stops a non-admin (or
  // no session) token from rendering the dashboard shell at all.
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    redirect("/wanderer/login");
  }
  return (
    <>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar userRole={user.role} />
          <SidebarInset>
            <DashboardHeader user={user} />
            {children}
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </>
  );
}
