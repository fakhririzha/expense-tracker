import { format } from "date-fns";

import type {
  CashFlowForecastStatus,
  DailyForecastBalance,
  ForecastRiskSummary,
  ForecastWarning,
} from "@/lib/forecasting/forecast-types";

export function getForecastRiskSummary(args: {
  dailyBalances: DailyForecastBalance[];
  projectedThirtyDayOutflow: number;
  historicalMonthlyOutflow: number;
  userMonthlyBudget: number | null;
  hasLowConfidenceSignals: boolean;
  hasRecurringEvents: boolean;
  futureTransactionAdjustmentApplied: boolean;
  existingWarnings: ForecastWarning[];
  lowestProjectedBalance: number;
  lowestProjectedBalanceDate: Date | null;
}): ForecastRiskSummary {
  const warnings = [...args.existingWarnings];
  const monthlyOutflowBasis =
    args.historicalMonthlyOutflow > 0
      ? args.historicalMonthlyOutflow
      : args.userMonthlyBudget && args.userMonthlyBudget > 0
        ? args.userMonthlyBudget
        : args.projectedThirtyDayOutflow;

  let status: CashFlowForecastStatus = "safe";

  if (args.lowestProjectedBalance < 0) {
    status = "negative";
    warnings.push({
      code: "negative_balance",
      severity: "danger",
      message: `Projected balance drops below zero on ${format(
        args.lowestProjectedBalanceDate ?? new Date(),
        "MMM d, yyyy"
      )}.`,
      date: args.lowestProjectedBalanceDate ?? undefined,
    });
  } else if (
    monthlyOutflowBasis > 0 &&
    args.lowestProjectedBalance < monthlyOutflowBasis * 0.1
  ) {
    status = "risky";
    warnings.push({
      code: "low_buffer_risky",
      severity: "danger",
      message: "Lowest projected balance is below your cash buffer threshold.",
      date: args.lowestProjectedBalanceDate ?? undefined,
    });
  } else if (
    monthlyOutflowBasis > 0 &&
    args.lowestProjectedBalance < monthlyOutflowBasis * 0.25
  ) {
    status = "watch";
    warnings.push({
      code: "low_buffer_watch",
      severity: "warning",
      message: "Projected cash buffer gets tight within this forecast window.",
      date: args.lowestProjectedBalanceDate ?? undefined,
    });
  }

  if (monthlyOutflowBasis > 0) {
    for (const day of args.dailyBalances) {
      if (day.outflow > monthlyOutflowBasis * 0.2) {
        warnings.push({
          code: "heavy_outflow_day",
          severity: "warning",
          message: `A large projected outflow lands on ${format(day.date, "MMM d, yyyy")}.`,
          date: day.date,
        });
        break;
      }
    }
  }

  if (args.hasLowConfidenceSignals) {
    warnings.push({
      code: "low_confidence_forecast",
      severity: "info",
      message:
        "This forecast includes estimated spending, so exact cash pressure may vary from actual results.",
    });
  }

  if (!args.hasRecurringEvents) {
    warnings.push({
      code: "no_recurring_data",
      severity: "info",
      message:
        "No active recurring income or expense rules were projected inside this horizon.",
    });
  }

  if (args.futureTransactionAdjustmentApplied) {
    warnings.push({
      code: "future_transaction_adjustment",
      severity: "info",
      message:
        "Future-dated transactions were reversed from the current balance before the projection was calculated.",
    });
  }

  return { status, warnings, monthlyOutflowBasis };
}
