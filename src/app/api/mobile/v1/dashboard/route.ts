import { NextResponse } from "next/server";

import { getExecutiveMetricsForUser } from "@/lib/executive-service";
import { authenticateMobileRequest } from "@/server/auth/mobile-session";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getExecutiveMetricsForUser(authenticated.userId);
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error ?? "Failed to fetch dashboard" },
        { status: 500 }
      );
    }

    const metrics = result.data;
    return NextResponse.json({
      displayCurrency: metrics.displayCurrency,
      position: {
        totalAssets: metrics.totalAssets,
        totalDebt: metrics.totalDebt,
        netWorth: metrics.netWorth,
        liquidFunds: metrics.totalCash + metrics.totalSavings,
        investmentValue: metrics.investmentValue,
      },
      cashFlow: {
        averageMonthlyIncome: metrics.avgMonthlyIncome,
        averageMonthlyExpenses: metrics.avgMonthlyExpenses,
        savingsRate: metrics.savingsRate,
        monthsOfRunway: metrics.monthsOfRunway,
      },
      health:
        metrics.healthTier &&
        metrics.healthTierInfo &&
        metrics.debtToWealthRatio !== null
          ? {
              tier: metrics.healthTier,
              label: metrics.healthTierInfo.label,
              description: metrics.healthTierInfo.description,
              debtToWealthRatio: metrics.debtToWealthRatio,
            }
          : null,
      valuationWarning: metrics.valuationError
        ? "Some investment values are temporarily unavailable."
        : null,
    });
  } catch (error) {
    console.error("Mobile dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
