"use server";

import {
  differenceInCalendarDays,
  endOfMonth,
  startOfDay,
  startOfMonth,
} from "date-fns";

import { getBudgetSpendingSummary } from "@/actions/budget-actions";
import { getCashFlowForecast } from "@/actions/forecast-actions";
import { getFinancialInsights } from "@/actions/insight-actions";
import { auth } from "@/auth";
import {
  buildDashboardMoneyPlan,
  type DashboardMoneyPlan,
} from "@/lib/dashboard-money-plan";
import prisma from "@/lib/db";

export async function getDashboardMoneyPlan(): Promise<{
  success: boolean;
  data?: DashboardMoneyPlan;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);
    const remainingCalendarDays =
      differenceInCalendarDays(periodEnd, startOfDay(now)) + 1;
    const forecastHorizon = remainingCalendarDays > 30 ? 60 : 30;

    const [user, spendingResult, forecastResult, insightsResult] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            mainCurrency: true,
            monthlyBudget: true,
          },
        }),
        getBudgetSpendingSummary(periodStart, now),
        getCashFlowForecast({
          horizonDays: forecastHorizon,
          includeFutureTransactions: true,
          includeRecurringTransactions: true,
          includeSubscriptions: true,
          variableSpendingMode: "none",
        }),
        getFinancialInsights({ scope: "dashboard", limit: 3 }),
      ]);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      data: buildDashboardMoneyPlan({
        now,
        periodStart,
        periodEnd,
        currency: user.mainCurrency,
        spendingLimit: user.monthlyBudget,
        spentToDate:
          spendingResult.success && spendingResult.data
            ? spendingResult.data.totalSpent
            : null,
        forecast:
          forecastResult.success && forecastResult.data
            ? forecastResult.data
            : null,
        actionItems:
          insightsResult.success && insightsResult.data
            ? insightsResult.data.insights
            : [],
      }),
    };
  } catch (error) {
    console.error("Get dashboard money plan error:", error);
    return { success: false, error: "Failed to build your monthly money plan" };
  }
}
