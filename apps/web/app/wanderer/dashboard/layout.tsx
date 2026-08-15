import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Dashboard",
  description: "Dashboard",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <DashboardHeader />
            {children}
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </>
  )
}