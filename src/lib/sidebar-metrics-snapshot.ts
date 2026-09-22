import "server-only";

import { startOfMonth } from "date-fns";

import { getExecutiveMetricsForUser } from "@/lib/executive-service";
import {
  clampSidebarPercentage,
  type SidebarMetricsSnapshot,
} from "@/lib/sidebar-metrics";
import { sumNormalizedAmount } from "@/lib/transaction-aggregates";

export async function buildSidebarMetricsSnapshot(
  userId: string,
  now: Date
): Promise<SidebarMetricsSnapshot> {
  const startDate = startOfMonth(now);
  const [metricsResult, totalSpent] = await Promise.all([
    getExecutiveMetricsForUser(userId),
    sumNormalizedAmount({
      userId,
      types: ["EXPENSE", "LIABILITY_PAYMENT"],
      from: startDate,
      to: now,
    }).catch((error: unknown) => {
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
