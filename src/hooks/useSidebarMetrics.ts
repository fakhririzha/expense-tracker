import { getExecutiveMetrics } from "@/lib/executive-service";
import { getBudgetSpendingSummary } from "@/actions/budget-actions";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, startOfMonth } from "date-fns";

export interface SidebarMetricsSnapshot {
  retirementTarget: number | null;
  retirementProgress: number | null;
  retirementLeftPercent: number | null;
  retirementAvailable: boolean;
  monthlyBudget: number | null;
  currentMonthExpenses: number | null;
  monthlyBudgetLeftPercent: number | null;
  monthlyBudgetAvailable: boolean;
  displayCurrency: string;
}

export const sidebarMetricsKeys = {
  all: ["sidebarMetrics"] as const,
  currentMonth: (year: number, month: number) =>
    [...sidebarMetricsKeys.all, "currentMonth", { year, month }] as const,
};

function clampPercentage(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

export function useSidebarMetrics() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return useQuery({
    queryKey: sidebarMetricsKeys.currentMonth(year, month),
    queryFn: async (): Promise<SidebarMetricsSnapshot> => {
      const startDate = startOfMonth(now);
      const endDate = endOfMonth(now);

      const [metricsResult, monthSummaryResult] = await Promise.allSettled([
        getExecutiveMetrics(),
        getBudgetSpendingSummary(startDate, endDate),
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
          ? clampPercentage(100 - retirementProgress)
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
          ? clampPercentage(100 - (currentMonthExpenses / monthlyBudget) * 100)
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
