"use client";

import { createContext, useContext, type ReactNode } from "react";

const SidebarMetricsPeriodContext = createContext<{
  year: number;
  month: number;
} | null>(null);

export function SidebarMetricsPeriodProvider({
  year,
  month,
  children,
}: {
  year: number;
  month: number;
  children: ReactNode;
}) {
  return (
    <SidebarMetricsPeriodContext.Provider value={{ year, month }}>
      {children}
    </SidebarMetricsPeriodContext.Provider>
  );
}

export function useSidebarMetricsPeriod(): { year: number; month: number } | null {
  return useContext(SidebarMetricsPeriodContext);
}
