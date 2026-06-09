import {
  getEventSortPriority,
} from "@/lib/forecasting/forecast-events";
import {
  getDateKey,
  getForecastDays,
  roundMoney,
} from "@/lib/forecasting/forecast-periods";
import type {
  DailyForecastBalance,
  ForecastEvent,
} from "@/lib/forecasting/forecast-types";

export function sortForecastEvents(events: ForecastEvent[]): ForecastEvent[] {
  return [...events].sort((left, right) => {
    const dateDiff = left.date.getTime() - right.date.getTime();
    if (dateDiff !== 0) return dateDiff;

    const priorityDiff =
      getEventSortPriority(left.source) - getEventSortPriority(right.source);
    if (priorityDiff !== 0) return priorityDiff;

    return left.label.localeCompare(right.label);
  });
}

export function projectCashFlow(args: {
  startDate: Date;
  endDate: Date;
  startingBalance: number;
  events: ForecastEvent[];
}): DailyForecastBalance[] {
  const groupedEvents = new Map<string, ForecastEvent[]>();
  for (const event of args.events) {
    const key = getDateKey(event.date);
    const list = groupedEvents.get(key) ?? [];
    list.push(event);
    groupedEvents.set(key, list);
  }

  const dailyBalances: DailyForecastBalance[] = [];
  let currentBalance = roundMoney(args.startingBalance);

  for (const day of getForecastDays(args.startDate, args.endDate)) {
    const dateKey = getDateKey(day);
    const dayEvents = sortForecastEvents(groupedEvents.get(dateKey) ?? []);
    const startingBalance = currentBalance;

    const inflow = roundMoney(
      dayEvents.reduce((sum, event) => {
        if (
          event.direction !== "inflow" ||
          event.excludedFromProjection ||
          event.amountInMainCurrency === null
        ) {
          return sum;
        }
        return sum + event.amountInMainCurrency;
      }, 0)
    );

    const outflow = roundMoney(
      dayEvents.reduce((sum, event) => {
        if (
          event.direction !== "outflow" ||
          event.excludedFromProjection ||
          event.amountInMainCurrency === null
        ) {
          return sum;
        }
        return sum + event.amountInMainCurrency;
      }, 0)
    );

    currentBalance = roundMoney(startingBalance + inflow - outflow);
    dailyBalances.push({
      date: day,
      dateKey,
      startingBalance,
      inflow,
      outflow,
      endingBalance: currentBalance,
      events: dayEvents,
    });
  }

  return dailyBalances;
}
