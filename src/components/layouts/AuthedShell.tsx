import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layouts/app-sidebar";
import { TopBar } from "@/components/layouts/TopBar";

export function AuthedShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
