export const BANK_INTEREST_FREQUENCIES = [
  "DAILY",
  "MONTHLY",
  "YEARLY",
] as const;

export type BankInterestFrequency =
  (typeof BANK_INTEREST_FREQUENCIES)[number];

export const BANK_INTEREST_FREQUENCY_LABELS: Record<
  BankInterestFrequency,
  string
> = {
  DAILY: "Daily",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function jakartaMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - JAKARTA_OFFSET_MS);
}

export function getNextBankInterestDate(
  from: Date,
  frequency: BankInterestFrequency
): Date {
  const { year, month, day } = jakartaDateParts(from);

  switch (frequency) {
    case "DAILY":
      return jakartaMidnight(year, month, day + 1);
    case "MONTHLY":
      return jakartaMidnight(year, month + 1, 1);
    case "YEARLY":
      return jakartaMidnight(year + 1, 0, 1);
  }
}

export function getCurrentJakartaBoundary(now: Date = new Date()): Date {
  const { year, month, day } = jakartaDateParts(now);
  return jakartaMidnight(year, month, day);
}

export function calculateBankInterest(input: {
  balance: number;
  annualRate: number;
  frequency: BankInterestFrequency;
}): number {
  const periods =
    input.frequency === "DAILY"
      ? 365
      : input.frequency === "MONTHLY"
        ? 12
        : 1;
  const amount = input.balance * (input.annualRate / 100) / periods;
  return Math.round((amount + Number.EPSILON) * 10000) / 10000;
}
