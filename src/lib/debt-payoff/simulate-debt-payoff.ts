import type {
  DebtPayoffInputDebt,
  DebtPayoffDebtSummary,
  DebtPayoffMonthDebtState,
  DebtPayoffMonthStep,
  DebtPayoffSimulationInput,
  DebtPayoffSimulationResult,
  DebtPayoffStrategyValue,
} from "@/lib/debt-payoff/types";

const DEFAULT_MAX_MONTHS = 600;
const BALANCE_EPSILON = 0.005;

interface WorkingDebt {
  id: string;
  name: string;
  balance: number;
  annualInterestRate: number;
  minimumPayment: number;
  priorityOverride: number | null;
  startingBalance: number;
  totalInterest: number;
  totalPaid: number;
  monthsToPayoff: number | null;
  payoffDate: string | null;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function monthlyRate(annualPercent: number): number {
  return Math.max(0, annualPercent) / 100 / 12;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isEffectivelyZero(balance: number): boolean {
  return balance <= BALANCE_EPSILON;
}

/**
 * Order active debts for the focus (extra-payment) slot.
 * Avalanche: highest APR first, then lowest balance, then name.
 * Snowball: lowest balance first, then highest APR, then name.
 * Custom: priorityOverride ascending (nulls last), then avalanche tie-breaks.
 */
export function orderDebtsForStrategy(
  debts: WorkingDebt[],
  strategy: DebtPayoffStrategyValue
): WorkingDebt[] {
  const active = debts.filter((debt) => !isEffectivelyZero(debt.balance));

  return active.slice().sort((left, right) => {
    if (strategy === "CUSTOM") {
      const leftPriority = left.priorityOverride ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.priorityOverride ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
    }

    if (strategy === "SNOWBALL") {
      if (left.balance !== right.balance) {
        return left.balance - right.balance;
      }
      if (left.annualInterestRate !== right.annualInterestRate) {
        return right.annualInterestRate - left.annualInterestRate;
      }
    } else {
      // AVALANCHE and CUSTOM fallback
      if (left.annualInterestRate !== right.annualInterestRate) {
        return right.annualInterestRate - left.annualInterestRate;
      }
      if (left.balance !== right.balance) {
        return left.balance - right.balance;
      }
    }

    return left.name.localeCompare(right.name);
  });
}

function normalizeInputDebts(debts: DebtPayoffInputDebt[]): WorkingDebt[] {
  return debts
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      balance: Math.max(0, debt.balance),
      annualInterestRate: Math.max(0, debt.annualInterestRate),
      minimumPayment: Math.max(0, debt.minimumPayment),
      priorityOverride: debt.priorityOverride ?? null,
      startingBalance: Math.max(0, debt.balance),
      totalInterest: 0,
      totalPaid: 0,
      monthsToPayoff: null,
      payoffDate: null,
    }))
    .filter((debt) => debt.startingBalance > BALANCE_EPSILON);
}

/**
 * Simulate a month-by-month debt payoff plan.
 *
 * Each month:
 * 1. Accrue simple monthly interest on remaining balances.
 * 2. Pay minimums on every active debt (capped at balance + interest).
 * 3. Apply extra payment (plus freed minimums from paid-off debts) to the focus debt.
 */
export function simulateDebtPayoff(
  input: DebtPayoffSimulationInput
): DebtPayoffSimulationResult {
  const maxMonths = input.maxMonths ?? DEFAULT_MAX_MONTHS;
  const startDate = input.startDate ?? new Date();
  const extraMonthlyAmount = Math.max(0, input.extraMonthlyAmount);
  const debts = normalizeInputDebts(input.debts);
  const warnings: string[] = [];

  const startingBalance = roundMoney(
    debts.reduce((sum, debt) => sum + debt.startingBalance, 0)
  );
  const monthlyMinimumTotal = roundMoney(
    debts.reduce((sum, debt) => sum + debt.minimumPayment, 0)
  );

  if (debts.length === 0) {
    return {
      strategy: input.strategy,
      extraMonthlyAmount,
      isPayable: true,
      monthsToDebtFree: 0,
      debtFreeDate: toDateKey(startDate),
      totalInterest: 0,
      totalPaid: 0,
      startingBalance: 0,
      monthlyMinimumTotal: 0,
      averageMonthlyPayment: 0,
      schedule: [],
      debtSummaries: [],
      hitMonthCap: false,
      warnings: ["No outstanding balances to pay off."],
    };
  }

  for (const debt of debts) {
    const rate = monthlyRate(debt.annualInterestRate);
    if (debt.minimumPayment <= 0 && extraMonthlyAmount <= 0) {
      warnings.push(
        `${debt.name} has no minimum payment and no extra budget is set.`
      );
    } else if (
      rate > 0 &&
      debt.minimumPayment > 0 &&
      debt.minimumPayment < debt.balance * rate &&
      extraMonthlyAmount <= 0
    ) {
      warnings.push(
        `${debt.name} minimum payment may not cover monthly interest alone.`
      );
    }
  }

  const schedule: DebtPayoffMonthStep[] = [];
  let monthIndex = 0;

  while (monthIndex < maxMonths) {
    const activeBefore = debts.filter((debt) => !isEffectivelyZero(debt.balance));
    if (activeBefore.length === 0) {
      break;
    }

    const paymentDate = addMonths(startDate, monthIndex);
    const dateKey = toDateKey(paymentDate);
    const focusOrder = orderDebtsForStrategy(debts, input.strategy);
    const focusDebtId = focusOrder[0]?.id ?? null;

    // Accrue interest
    const interestById = new Map<string, number>();
    for (const debt of debts) {
      if (isEffectivelyZero(debt.balance)) {
        interestById.set(debt.id, 0);
        continue;
      }
      const interest = roundMoney(debt.balance * monthlyRate(debt.annualInterestRate));
      debt.balance = roundMoney(debt.balance + interest);
      debt.totalInterest = roundMoney(debt.totalInterest + interest);
      interestById.set(debt.id, interest);
    }

    const startingBalances = new Map(
      debts.map((debt) => [debt.id, debt.balance] as const)
    );
    const paymentById = new Map<string, number>();

    // Minimum payments
    let freedFromPayoffs = 0;
    for (const debt of debts) {
      if (isEffectivelyZero(debt.balance)) {
        paymentById.set(debt.id, 0);
        continue;
      }

      const payment = roundMoney(Math.min(debt.minimumPayment, debt.balance));
      debt.balance = roundMoney(debt.balance - payment);
      debt.totalPaid = roundMoney(debt.totalPaid + payment);
      paymentById.set(debt.id, payment);

      if (isEffectivelyZero(debt.balance)) {
        debt.balance = 0;
        if (debt.monthsToPayoff === null) {
          debt.monthsToPayoff = monthIndex + 1;
          debt.payoffDate = dateKey;
        }
        const unusedMinimum = roundMoney(debt.minimumPayment - payment);
        if (unusedMinimum > 0) {
          freedFromPayoffs = roundMoney(freedFromPayoffs + unusedMinimum);
        }
      }
    }

    // Extra + cascade toward focus debt(s)
    let remainingExtra = roundMoney(extraMonthlyAmount + freedFromPayoffs);
    const orderedForExtra = orderDebtsForStrategy(debts, input.strategy);

    for (const focus of orderedForExtra) {
      if (remainingExtra <= BALANCE_EPSILON) {
        break;
      }
      if (isEffectivelyZero(focus.balance)) {
        continue;
      }

      const extraPayment = roundMoney(Math.min(remainingExtra, focus.balance));
      focus.balance = roundMoney(focus.balance - extraPayment);
      focus.totalPaid = roundMoney(focus.totalPaid + extraPayment);
      paymentById.set(
        focus.id,
        roundMoney((paymentById.get(focus.id) ?? 0) + extraPayment)
      );
      remainingExtra = roundMoney(remainingExtra - extraPayment);

      if (isEffectivelyZero(focus.balance)) {
        focus.balance = 0;
        if (focus.monthsToPayoff === null) {
          focus.monthsToPayoff = monthIndex + 1;
          focus.payoffDate = dateKey;
        }
      }
    }

    const monthDebts: DebtPayoffMonthDebtState[] = debts.map((debt) => {
      const starting = startingBalances.get(debt.id) ?? 0;
      const payment = paymentById.get(debt.id) ?? 0;
      const interest = interestById.get(debt.id) ?? 0;
      return {
        id: debt.id,
        name: debt.name,
        startingBalance: starting,
        interestAccrued: interest,
        payment,
        endingBalance: debt.balance,
        paidOff: isEffectivelyZero(debt.balance) && starting > BALANCE_EPSILON,
      };
    });

    const totalPayment = roundMoney(
      monthDebts.reduce((sum, row) => sum + row.payment, 0)
    );
    const totalInterest = roundMoney(
      monthDebts.reduce((sum, row) => sum + row.interestAccrued, 0)
    );
    const remainingBalance = roundMoney(
      debts.reduce((sum, debt) => sum + debt.balance, 0)
    );

    schedule.push({
      monthIndex: monthIndex + 1,
      date: dateKey,
      totalPayment,
      totalInterest,
      totalPrincipal: roundMoney(totalPayment - totalInterest),
      remainingBalance,
      debts: monthDebts,
      focusDebtId,
    });

    monthIndex += 1;

    // Detect stagnation (no payment applied while balance remains)
    if (totalPayment <= BALANCE_EPSILON && remainingBalance > BALANCE_EPSILON) {
      warnings.push(
        "Payments are not reducing balances. Increase minimums or extra monthly amount."
      );
      break;
    }
  }

  const remainingBalance = roundMoney(
    debts.reduce((sum, debt) => sum + debt.balance, 0)
  );
  const hitMonthCap = remainingBalance > BALANCE_EPSILON;
  const isPayable = !hitMonthCap;

  if (hitMonthCap) {
    warnings.push(
      `Plan did not reach zero within ${maxMonths} months. Increase payments or check interest rates.`
    );
  }

  const totalInterest = roundMoney(
    debts.reduce((sum, debt) => sum + debt.totalInterest, 0)
  );
  const totalPaid = roundMoney(
    debts.reduce((sum, debt) => sum + debt.totalPaid, 0)
  );
  const monthsToDebtFree = isPayable ? schedule.length : null;
  const debtFreeDate =
    isPayable && schedule.length > 0
      ? schedule[schedule.length - 1]!.date
      : isPayable
        ? toDateKey(startDate)
        : null;

  const debtSummaries: DebtPayoffDebtSummary[] = debts.map((debt) => ({
    id: debt.id,
    name: debt.name,
    startingBalance: debt.startingBalance,
    totalInterest: debt.totalInterest,
    totalPaid: debt.totalPaid,
    monthsToPayoff: debt.monthsToPayoff,
    payoffDate: debt.payoffDate,
  }));

  return {
    strategy: input.strategy,
    extraMonthlyAmount,
    isPayable,
    monthsToDebtFree,
    debtFreeDate,
    totalInterest,
    totalPaid,
    startingBalance,
    monthlyMinimumTotal,
    averageMonthlyPayment:
      schedule.length > 0
        ? roundMoney(totalPaid / schedule.length)
        : monthlyMinimumTotal + extraMonthlyAmount,
    schedule,
    debtSummaries,
    hitMonthCap,
    warnings: Array.from(new Set(warnings)),
  };
}
