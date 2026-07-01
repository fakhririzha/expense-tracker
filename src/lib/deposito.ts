export const DEPOSITO_INTEREST_FREQUENCIES = [
  "DAILY",
  "MONTHLY",
  "YEARLY",
] as const;

export type DepositoInterestFrequencyValue =
  (typeof DEPOSITO_INTEREST_FREQUENCIES)[number];

export const DEPOSITO_TERM_MODES = [
  "OPEN_ENDED",
  "FIXED_TERM",
] as const;

export type DepositoTermModeValue = (typeof DEPOSITO_TERM_MODES)[number];

export const DEPOSITO_STATUSES = [
  "ACTIVE",
  "MATURED",
  "CLOSED",
] as const;

export type DepositoStatusValue = (typeof DEPOSITO_STATUSES)[number];

export const DEPOSITO_INTEREST_FREQUENCY_LABELS: Record<
  DepositoInterestFrequencyValue,
  string
> = {
  DAILY: "Daily",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const DEPOSITO_TERM_MODE_LABELS: Record<DepositoTermModeValue, string> = {
  OPEN_ENDED: "Open ended",
  FIXED_TERM: "Fixed term",
};

export const DEPOSITO_STATUS_LABELS: Record<DepositoStatusValue, string> = {
  ACTIVE: "Active",
  MATURED: "Matured",
  CLOSED: "Closed",
};

function createUtcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
}

function getDaysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function parseDateInput(dateInput: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (!match) {
    throw new Error("Invalid date value.");
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(day) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    throw new Error("Invalid date value.");
  }

  const maxDay = getDaysInUtcMonth(year, monthIndex);
  if (day < 1 || day > maxDay) {
    throw new Error("Invalid date value.");
  }

  return createUtcDate(year, monthIndex, day);
}

export function formatDateInput(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfUtcDay(date: Date): Date {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

export function getTodayUtc(): Date {
  return startOfUtcDay(new Date());
}

function addUtcDays(date: Date, days: number): Date {
  return createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + days
  );
}

function addUtcMonths(date: Date, months: number): Date {
  const nextMonthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(nextMonthIndex / 12);
  const monthIndex = ((nextMonthIndex % 12) + 12) % 12;
  const day = Math.min(
    date.getUTCDate(),
    getDaysInUtcMonth(year, monthIndex)
  );

  return createUtcDate(year, monthIndex, day);
}

function addUtcYears(date: Date, years: number): Date {
  const year = date.getUTCFullYear() + years;
  const monthIndex = date.getUTCMonth();
  const day = Math.min(
    date.getUTCDate(),
    getDaysInUtcMonth(year, monthIndex)
  );

  return createUtcDate(year, monthIndex, day);
}

export function addDepositoInterval(
  date: Date,
  frequency: DepositoInterestFrequencyValue
): Date {
  switch (frequency) {
    case "DAILY":
      return addUtcDays(date, 1);
    case "MONTHLY":
      return addUtcMonths(date, 1);
    case "YEARLY":
      return addUtcYears(date, 1);
  }
}

export function calculateFirstDepositoInterestDate(
  startDate: Date,
  frequency: DepositoInterestFrequencyValue
): Date {
  return addDepositoInterval(startDate, frequency);
}

export function getNextDepositoInterestDate(
  startDate: Date,
  frequency: DepositoInterestFrequencyValue,
  lastPostedDate: Date | null
): Date {
  let nextDate = calculateFirstDepositoInterestDate(startDate, frequency);

  while (lastPostedDate && nextDate.getTime() <= lastPostedDate.getTime()) {
    nextDate = addDepositoInterval(nextDate, frequency);
  }

  return nextDate;
}

export function isValidDepositoMaturityDate(
  startDate: Date,
  frequency: DepositoInterestFrequencyValue,
  maturityDate: Date
): boolean {
  let nextDate = calculateFirstDepositoInterestDate(startDate, frequency);

  while (nextDate.getTime() < maturityDate.getTime()) {
    nextDate = addDepositoInterval(nextDate, frequency);
  }

  return nextDate.getTime() === maturityDate.getTime();
}

export function roundDepositoMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function calculateDepositoInterestAmount(input: {
  balance: number;
  ratePercent: number;
  taxRatePercent?: number | null;
}) {
  const grossInterest = roundDepositoMoney(
    input.balance * (input.ratePercent / 100)
  );
  const taxAmount = roundDepositoMoney(
    grossInterest * ((input.taxRatePercent ?? 0) / 100)
  );
  const netInterest = roundDepositoMoney(grossInterest - taxAmount);

  return {
    grossInterest,
    taxAmount,
    netInterest,
  };
}
