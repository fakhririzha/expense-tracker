import type { MobileDashboardResponse } from "@finhealth/contracts";

import type { HealthTier, HealthTierInfo } from "@/lib/executive-types";

interface MobileDashboardMetrics {
  displayCurrency: string;
  totalAssets: number | null;
  totalDebt: number;
  netWorth: number | null;
  totalCash: number;
  totalSavings: number;
  investmentValue: number | null;
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
  savingsRate: number;
  monthsOfRunway: number;
  healthTier: HealthTier | null;
  healthTierInfo: HealthTierInfo | null;
  debtToWealthRatio: number | null;
  valuationError: string | null;
  currencyConversionError: string | null;
}

export function createMobileDashboardResponse(
  metrics: MobileDashboardMetrics
): MobileDashboardResponse {
  const hasReliablePosition = !metrics.currencyConversionError;
  const warnings = [
    metrics.currencyConversionError,
    metrics.valuationError
      ? "Some investment values are temporarily unavailable."
      : null,
  ].filter((warning): warning is string => Boolean(warning));

  return {
    displayCurrency: metrics.displayCurrency,
    position: {
      totalAssets: hasReliablePosition ? metrics.totalAssets : null,
      totalDebt: hasReliablePosition ? metrics.totalDebt : null,
      netWorth: hasReliablePosition ? metrics.netWorth : null,
      liquidFunds: hasReliablePosition
        ? metrics.totalCash + metrics.totalSavings
        : null,
      investmentValue: metrics.investmentValue,
    },
    cashFlow: {
      averageMonthlyIncome: metrics.avgMonthlyIncome,
      averageMonthlyExpenses: metrics.avgMonthlyExpenses,
      savingsRate: metrics.savingsRate,
      monthsOfRunway: hasReliablePosition ? metrics.monthsOfRunway : null,
    },
    health:
      metrics.healthTier &&
      metrics.healthTierInfo &&
      metrics.debtToWealthRatio !== null &&
      hasReliablePosition
        ? {
            tier: metrics.healthTier,
            label: metrics.healthTierInfo.label,
            description: metrics.healthTierInfo.description,
            debtToWealthRatio: metrics.debtToWealthRatio,
          }
        : null,
    valuationWarning: warnings.length > 0 ? warnings.join(" ") : null,
  };
}
