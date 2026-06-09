import { eachDayOfInterval, subDays } from "date-fns";

import { buildForecastEvent } from "@/lib/forecasting/forecast-events";
import { getDateKey, roundMoney } from "@/lib/forecasting/forecast-periods";
import type { ForecastEvent, ForecastWarning } from "@/lib/forecasting/forecast-types";

export interface HistoricalExpensePoint {
  amountInMainCurrency: number;
  date: Date;
}

export interface HistoricalEstimateResult {
  events: ForecastEvent[];
  warnings: ForecastWarning[];
}

export function buildHistoricalSpendingEstimate(args: {
  history: HistoricalExpensePoint[];
  startDate: Date;
  endDate: Date;
  currency: string;
}): HistoricalEstimateResult {
  const warnings: ForecastWarning[] = [];
  if (args.history.length === 0) {
    warnings.push({
      code: "historical_spending_sparse",
      severity: "warning",
      message: "Historical spending estimate is unavailable because there is not enough recent expense history.",
    });
    return { events: [], warnings };
  }

  const dailyTotals = new Map<string, number>();
  for (const item of args.history) {
    const key = getDateKey(item.date);
    dailyTotals.set(key, roundMoney((dailyTotals.get(key) ?? 0) + item.amountInMainCurrency));
  }

  const values = Array.from(dailyTotals.values()).sort((left, right) => left - right);
  const trimmedValues =
    values.length >= 10 ? values.slice(1, values.length - 1) : values;
  const averageDailySpend =
    trimmedValues.reduce((sum, value) => sum + value, 0) /
    Math.max(trimmedValues.length, 1);

  if (dailyTotals.size < 14) {
    warnings.push({
      code: "historical_spending_sparse",
      severity: "warning",
      message: "Historical spending estimate is based on limited recent expense history.",
    });
  }

  if (averageDailySpend <= 0) {
    return { events: [], warnings };
  }

  const events = eachDayOfInterval({
    start: args.startDate,
    end: args.endDate,
  }).map((date, index) =>
    buildForecastEvent({
      id: `historical-spend-${getDateKey(date)}-${index}`,
      date,
      type: "estimated_spending",
      label: "Estimated daily spending",
      amount: roundMoney(averageDailySpend),
      currency: args.currency,
      amountInMainCurrency: roundMoney(averageDailySpend),
      direction: "outflow",
      confidence: "low",
      source: "historical_average",
      conversionRate: 1,
      conversionSource: "identity",
    })
  );

  return { events, warnings };
}

export function getHistoricalLookbackStart(referenceDate: Date): Date {
  return subDays(referenceDate, 90);
}
