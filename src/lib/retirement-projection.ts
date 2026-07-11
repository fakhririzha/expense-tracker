export interface RetirementProjection {
  retirementDate: string;
  monthsRemaining: number;
  remainingAmount: number;
  requiredMonthlySavings: number;
}

interface RetirementProjectionInput {
  retirementTarget: number | null;
  currentNetWorth: number | null;
  dateOfBirth: Date | string | null;
  retirementAge: number | null;
  asOf?: Date;
}

function toDateOnly(value: Date | string): Date | null {
  if (typeof value === "string") {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return Number.isNaN(value.getTime()) ? null : value;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getRetirementDate(
  dateOfBirth: Date | string,
  retirementAge: number
): Date | null {
  const birthDate = toDateOnly(dateOfBirth);
  if (!birthDate || !Number.isInteger(retirementAge) || retirementAge < 1) {
    return null;
  }

  const retirementDate = new Date(birthDate);
  retirementDate.setFullYear(birthDate.getFullYear() + retirementAge);

  return retirementDate;
}

export function calculateRetirementProjection({
  retirementTarget,
  currentNetWorth,
  dateOfBirth,
  retirementAge,
  asOf = new Date(),
}: RetirementProjectionInput): RetirementProjection | null {
  if (
    !retirementTarget ||
    retirementTarget <= 0 ||
    currentNetWorth === null ||
    !dateOfBirth ||
    retirementAge === null
  ) {
    return null;
  }

  const retirementDate = getRetirementDate(dateOfBirth, retirementAge);
  if (!retirementDate || retirementDate <= asOf) {
    return null;
  }

  const monthsRemaining = Math.max(
    1,
    (retirementDate.getFullYear() - asOf.getFullYear()) * 12 +
      retirementDate.getMonth() -
      asOf.getMonth()
  );
  const remainingAmount = Math.max(retirementTarget - currentNetWorth, 0);

  return {
    retirementDate: toDateInputValue(retirementDate),
    monthsRemaining,
    remainingAmount,
    requiredMonthlySavings: remainingAmount / monthsRemaining,
  };
}
