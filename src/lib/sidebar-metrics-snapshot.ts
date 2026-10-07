import "server-only";

import { getExecutiveMetricsForUser } from "@/lib/executive-service";
import {
  clampSidebarPercentage,
  type SidebarMetricsSnapshot,
} from "@/lib/sidebar-metrics";
import { getDashboardMonthSpending } from "@/lib/dashboard-spending";

export async function buildSidebarMetricsSnapshot(
  userId: string,
  now: Date
): Promise<SidebarMetricsSnapshot> {
  const [metricsResult, totalSpent] = await Promise.all([
    getExecutiveMetricsForUser(userId),
    getDashboardMonthSpending(userId, now.toISOString()).catch((error: unknown) => {
      console.error("Sidebar month spending error:", error);
      return null;
    }),
  ]);

  const metrics = metricsResult.success ? metricsResult.data : undefined;
  const retirementTarget = metrics?.retirementTarget ?? null;
  const retirementProgress = metrics?.retirementProgress ?? null;
  const monthlyBudget = metrics?.monthlyBudget ?? null;
  const currentMonthExpenses = totalSpent;

  return {
    retirementTarget,
    retirementProgress,
    retirementLeftPercent:
      retirementProgress !== null
        ? clampSidebarPercentage(100 - retirementProgress)
        : null,
    retirementAvailable: metricsResult.success,
    monthlyBudget,
    currentMonthExpenses,
    monthlyBudgetLeftPercent:
      monthlyBudget && monthlyBudget > 0 && currentMonthExpenses !== null
        ? clampSidebarPercentage(100 - (currentMonthExpenses / monthlyBudget) * 100)
        : null,
    monthlyBudgetAvailable: metricsResult.success && currentMonthExpenses !== null,
    displayCurrency: metrics?.displayCurrency ?? "IDR",
  };
}
