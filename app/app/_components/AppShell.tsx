"use client";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { useInboundMessageAlerts } from "@/hooks/notifications/useInboundMessageAlerts";
import { useCrmAlerts } from "@/hooks/notifications/useCrmAlerts";
import { useNotifyOpenFromServiceWorker } from "@/lib/notifications/notify_open";

interface AppShellProps {
  sidebarCollapsed: boolean;
  children: ReactNode;
}

export function AppShell({ sidebarCollapsed, children }: AppShellProps) {
  useInboundMessageAlerts();
  useCrmAlerts();
  useNotifyOpenFromServiceWorker();
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 dark:bg-background">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:block h-full">
          <Sidebar collapsed={sidebarCollapsed} />
        </div>
        <main className="flex flex-1 flex-col overflow-auto bg-bg min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
