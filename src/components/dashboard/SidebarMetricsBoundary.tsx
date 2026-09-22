import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { cache } from "react";
import type { ReactNode } from "react";

import { SidebarMetricsPeriodProvider } from "@/components/dashboard/SidebarMetricsPeriod";
import { sidebarMetricsKeys } from "@/lib/sidebar-metrics";
import { buildSidebarMetricsSnapshot } from "@/lib/sidebar-metrics-snapshot";

const loadSidebarMetricsState = cache(async (userId: string, nowIso: string) => {
  const now = new Date(nowIso);
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: sidebarMetricsKeys.currentMonth(now.getFullYear(), now.getMonth()),
    queryFn: () => buildSidebarMetricsSnapshot(userId, now),
  });
  return dehydrate(queryClient);
});

export async function SidebarMetricsBoundary({
  userId,
  nowIso,
  children,
}: {
  userId: string;
  nowIso: string;
  children: ReactNode;
}) {
  const now = new Date(nowIso);
  const state = await loadSidebarMetricsState(userId, nowIso);

  return (
    <HydrationBoundary state={state}>
      <SidebarMetricsPeriodProvider year={now.getFullYear()} month={now.getMonth()}>
        {children}
      </SidebarMetricsPeriodProvider>
    </HydrationBoundary>
  );
}
