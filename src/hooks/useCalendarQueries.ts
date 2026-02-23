import { useQuery } from "@tanstack/react-query";
import {
  getCalendarEvents,
  getUpcomingBills,
  getMonthSummary,
} from "@/actions/calendar-actions";
import type { TransactionType } from "@/generated/prisma/client/client";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const calendarKeys = {
  all: ["calendar"] as const,
  events: (year: number, month: number) =>
    [...calendarKeys.all, "events", { year, month }] as const,
  upcoming: (days: number) =>
    [...calendarKeys.all, "upcoming", { days }] as const,
  monthSummary: (year: number, month: number) =>
    [...calendarKeys.all, "monthSummary", { year, month }] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCalendarEvents(
  year: number,
  month: number,
  options?: { accountId?: string; type?: TransactionType }
) {
  return useQuery({
    queryKey: calendarKeys.events(year, month),
    queryFn: async () => {
      const result = await getCalendarEvents({
        year,
        month,
        ...options,
      });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useUpcomingBills(days: number = 7) {
  return useQuery({
    queryKey: calendarKeys.upcoming(days),
    queryFn: async () => {
      const result = await getUpcomingBills({ days });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useMonthSummary(year: number, month: number) {
  return useQuery({
    queryKey: calendarKeys.monthSummary(year, month),
    queryFn: async () => {
      const result = await getMonthSummary({ year, month });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}
