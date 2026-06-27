"use client";

import { usePathname } from "next/navigation";
import { DashboardProvider } from "@/lib/dashboard-context";
import { DashboardHeader } from "./DashboardHeader";
import type { ReactNode } from "react";

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/agente")) return <>{children}</>;

  return (
    <DashboardProvider>
      <DashboardHeader />
      {children}
    </DashboardProvider>
  );
}
