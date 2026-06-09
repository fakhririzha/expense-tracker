import type { NetWorthPeriod } from "@/lib/net-worth-types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function getPreviousMonthPeriod(nowUtc: Date): NetWorthPeriod {
  const year = nowUtc.getUTCFullYear();
  const month = nowUtc.getUTCMonth() + 1;

  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
}

export function getLastDayOfMonthUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

export function getFirstDayOfMonthUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

export function shouldRunMonthlySnapshot(nowUtc: Date): boolean {
  return nowUtc.getUTCDate() === 1;
}

export function getPeriodKey(period: NetWorthPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function getPeriodLabel(period: NetWorthPeriod): string {
  return `${MONTH_LABELS[period.month - 1]} ${period.year}`;
}

export function isFuturePeriod(period: NetWorthPeriod, nowUtc: Date): boolean {
  const currentYear = nowUtc.getUTCFullYear();
  const currentMonth = nowUtc.getUTCMonth() + 1;

  return (
    period.year > currentYear ||
    (period.year === currentYear && period.month > currentMonth)
  );
}

export function getPeriodMonthsAgo(nowUtc: Date, months: number): NetWorthPeriod {
  const date = new Date(
    Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0, 0)
  );
  date.setUTCMonth(date.getUTCMonth() - months);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}
