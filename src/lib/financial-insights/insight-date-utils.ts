import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfMonth,
  formatISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

import type { RecurringInterval } from "@/generated/prisma/client/client";
import type { FinancialInsightPeriod } from "@/lib/financial-insights/insight-types";

export interface InsightDateRange {
  from: Date;
  to: Date;
}

export function getInsightPeriodKey(date: Date): string {
  return formatISO(startOfMonth(date), { representation: "date" });
}

export function getCurrentMonthToDateRange(now: Date): InsightDateRange {
  return {
    from: startOfMonth(now),
    to: now,
  };
}

export function getPreviousComparableMonthRange(now: Date): InsightDateRange {
  const previousDate = subMonths(now, 1);
  const from = startOfMonth(previousDate);
  const previousMonthEnd = endOfMonth(previousDate);
  const comparableDay = Math.min(now.getDate(), previousMonthEnd.getDate());
  const to = new Date(previousDate);
  to.setDate(comparableDay);
  to.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

  return {
    from,
    to: to > previousMonthEnd ? previousMonthEnd : to,
  };
}

export function getSixMonthLookbackStart(now: Date): Date {
  return startOfMonth(subMonths(now, 5));
}

export function getInactiveAccountLookbackStart(now: Date): Date {
  return subDays(now, 180);
}

export function toInsightPeriod(range: InsightDateRange): FinancialInsightPeriod {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  };
}

export function getDaysBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}

export function addRecurringInterval(
  date: Date,
  interval: RecurringInterval
): Date {
  switch (interval) {
    case "DAILY":
      return addDays(date, 1);
    case "WEEKLY":
      return addWeeks(date, 1);
    case "BIWEEKLY":
      return addWeeks(date, 2);
    case "MONTHLY":
      return addMonths(date, 1);
    case "QUARTERLY":
      return addQuarters(date, 1);
    case "YEARLY":
      return addYears(date, 1);
    default:
      return addMonths(date, 1);
  }
}

export function countRecurringOccurrencesWithinRange(input: {
  startDate: Date;
  interval: RecurringInterval;
  rangeEnd: Date;
  endDate?: Date | null;
}): number {
  let count = 0;
  let cursor = new Date(input.startDate);

  while (cursor <= input.rangeEnd) {
    if (!input.endDate || cursor <= input.endDate) {
      count += 1;
    }

    cursor = addRecurringInterval(cursor, input.interval);
  }

  return count;
}
