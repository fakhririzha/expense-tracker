import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
} from "date-fns";

import type { ForecastHorizonDays } from "@/lib/forecasting/forecast-types";

export function roundMoney(value: number, decimals: number = 4): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function getDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function getForecastDateRange(
  horizonDays: ForecastHorizonDays,
  now: Date = new Date()
) {
  const startDate = startOfDay(now);
  const endDate = endOfDay(addDays(startDate, horizonDays - 1));

  return { startDate, endDate };
}

export function getForecastDays(startDate: Date, endDate: Date): Date[] {
  return eachDayOfInterval({
    start: startOfDay(startDate),
    end: startOfDay(endDate),
  });
}
