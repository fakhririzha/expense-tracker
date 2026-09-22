import { getExecutiveMetrics } from "@/actions/executive-actions";
import { getBudgetSpendingSummary } from "@/actions/budget-actions";
import { useSidebarMetricsPeriod } from "@/components/dashboard/SidebarMetricsPeriod";
import {
  clampSidebarPercentage,
  sidebarMetricsKeys,
  type SidebarMetricsSnapshot,
} from "@/lib/sidebar-metrics";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth } from "date-fns";

export type { SidebarMetricsSnapshot } from "@/lib/sidebar-metrics";
export { sidebarMetricsKeys } from "@/lib/sidebar-metrics";

export function useSidebarMetrics(options?: { enabled?: boolean }) {
  const period = useSidebarMetricsPeriod();
  const now = new Date();
  const year = period?.year ?? now.getFullYear();
  const month = period?.month ?? now.getMonth();

  return useQuery({
    queryKey: sidebarMetricsKeys.currentMonth(year, month),
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<SidebarMetricsSnapshot> => {
      const startDate = startOfMonth(now);

      const [metricsResult, monthSummaryResult] = await Promise.allSettled([
        getExecutiveMetrics(),
        getBudgetSpendingSummary(startDate, now),
      ]);

      const metrics =
        metricsResult.status === "fulfilled" && metricsResult.value.success
          ? metricsResult.value.data
          : undefined;

      const monthSummary =
        monthSummaryResult.status === "fulfilled" && monthSummaryResult.value.success
          ? monthSummaryResult.value.data
          : undefined;

      const retirementTarget = metrics?.retirementTarget ?? null;
      const retirementProgress = metrics?.retirementProgress ?? null;
      const retirementAvailable =
        metricsResult.status === "fulfilled" && metricsResult.value.success;

      const retirementLeftPercent =
        retirementProgress !== null
          ? clampSidebarPercentage(100 - retirementProgress)
          : null;

      const monthlyBudget = metrics?.monthlyBudget ?? null;
      const currentMonthExpenses = monthSummary?.totalSpent ?? null;
      const monthlyBudgetAvailable =
        metricsResult.status === "fulfilled" &&
        metricsResult.value.success &&
        monthSummaryResult.status === "fulfilled" &&
        monthSummaryResult.value.success;

      const monthlyBudgetLeftPercent =
        monthlyBudget && monthlyBudget > 0 && currentMonthExpenses !== null
          ? clampSidebarPercentage(100 - (currentMonthExpenses / monthlyBudget) * 100)
          : null;

      return {
        retirementTarget,
        retirementProgress,
        retirementLeftPercent,
        retirementAvailable,
        monthlyBudget,
        currentMonthExpenses,
        monthlyBudgetLeftPercent,
        monthlyBudgetAvailable,
        displayCurrency: metrics?.displayCurrency ?? "IDR",
      };
    },
  });
}
