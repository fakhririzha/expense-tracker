import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  isAfter,
  isBefore,
  max,
  min,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";

import { BudgetPeriod } from "@/generated/prisma/client/client";
import { buildForecastEvent } from "@/lib/forecasting/forecast-events";
import { getDateKey, roundMoney } from "@/lib/forecasting/forecast-periods";
import type { ForecastEvent } from "@/lib/forecasting/forecast-types";

export interface ForecastBudget {
  id: string;
  name: string;
  amount: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date | null;
  categoryId: string | null;
}

function getBudgetWindow(period: BudgetPeriod, date: Date) {
  switch (period) {
    case "MONTHLY":
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case "QUARTERLY":
      return { start: startOfQuarter(date), end: endOfQuarter(date) };
    case "YEARLY":
      return { start: startOfYear(date), end: endOfYear(date) };
    default:
      return { start: startOfMonth(date), end: endOfMonth(date) };
  }
}

export function buildBudgetForecastEvents(args: {
  budgets: ForecastBudget[];
  startDate: Date;
  endDate: Date;
  actualSpentByBudgetId: Map<string, number>;
  plannedExpenseByCategoryId: Map<string, number>;
  uncategorizedPlannedExpense: number;
  currency: string;
}): ForecastEvent[] {
  const events: ForecastEvent[] = [];

  for (const budget of args.budgets) {
    const baseWindow = getBudgetWindow(budget.period, args.startDate);
    const budgetStart = max([startOfDay(baseWindow.start), startOfDay(budget.startDate)]);
    const configuredEnd = budget.endDate ? startOfDay(budget.endDate) : startOfDay(baseWindow.end);
    const budgetEnd = min([startOfDay(baseWindow.end), configuredEnd, startOfDay(args.endDate)]);

    if (isAfter(budgetStart, budgetEnd)) {
      continue;
    }

    if (isBefore(budgetEnd, startOfDay(args.startDate))) {
      continue;
    }

    const actualSpent = args.actualSpentByBudgetId.get(budget.id) ?? 0;
    const plannedFutureSpend = budget.categoryId
      ? args.plannedExpenseByCategoryId.get(budget.categoryId) ?? 0
      : args.uncategorizedPlannedExpense;

    const remainingBudget = roundMoney(
      Math.max(budget.amount - actualSpent - plannedFutureSpend, 0)
    );

    if (remainingBudget <= 0) {
      continue;
    }

    const projectionStart = max([startOfDay(args.startDate), budgetStart]);
    const days =
      Math.floor(
        (startOfDay(budgetEnd).getTime() - startOfDay(projectionStart).getTime()) /
          (24 * 60 * 60 * 1000)
      ) + 1;

    if (days <= 0) {
      continue;
    }

    const dailyAmount = roundMoney(remainingBudget / days);
    for (let index = 0; index < days; index += 1) {
      const date = new Date(projectionStart);
      date.setDate(projectionStart.getDate() + index);

      events.push(
        buildForecastEvent({
          id: `budget-${budget.id}-${getDateKey(date)}`,
          date,
          type: "estimated_spending",
          label: budget.categoryId
            ? `Budget pace: ${budget.name}`
            : "Budget-based spending pace",
          amount: dailyAmount,
          currency: args.currency,
          amountInMainCurrency: dailyAmount,
          direction: "outflow",
          confidence: "low",
          source: "budget",
          sourceId: budget.id,
          categoryId: budget.categoryId,
          conversionRate: 1,
          conversionSource: "identity",
        })
      );
    }
  }

  return events;
}
