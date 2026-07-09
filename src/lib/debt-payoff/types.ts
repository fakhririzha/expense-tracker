export type DebtPayoffStrategyValue = "AVALANCHE" | "SNOWBALL" | "CUSTOM";

export interface DebtPayoffInputDebt {
  id: string;
  name: string;
  /** Outstanding balance in plan currency (always positive). */
  balance: number;
  /** Annual percentage rate, e.g. 18.5 for 18.5%. */
  annualInterestRate: number;
  /** Minimum monthly payment in plan currency. */
  minimumPayment: number;
  /** Lower value = higher priority for CUSTOM strategy. */
  priorityOverride?: number | null;
}

export interface DebtPayoffSimulationInput {
  debts: DebtPayoffInputDebt[];
  strategy: DebtPayoffStrategyValue;
  /** Extra amount applied to the current focus debt each month after minimums. */
  extraMonthlyAmount: number;
  /** Optional simulation start; defaults to current UTC date. */
  startDate?: Date;
  /** Safety cap so impossible plans fail cleanly. */
  maxMonths?: number;
}

export interface DebtPayoffMonthDebtState {
  id: string;
  name: string;
  startingBalance: number;
  interestAccrued: number;
  payment: number;
  endingBalance: number;
  paidOff: boolean;
}

export interface DebtPayoffMonthStep {
  monthIndex: number;
  /** ISO date (YYYY-MM-DD) for the payment month. */
  date: string;
  totalPayment: number;
  totalInterest: number;
  totalPrincipal: number;
  remainingBalance: number;
  debts: DebtPayoffMonthDebtState[];
  focusDebtId: string | null;
}

export interface DebtPayoffDebtSummary {
  id: string;
  name: string;
  startingBalance: number;
  totalInterest: number;
  totalPaid: number;
  monthsToPayoff: number | null;
  payoffDate: string | null;
}

export interface DebtPayoffSimulationResult {
  strategy: DebtPayoffStrategyValue;
  extraMonthlyAmount: number;
  currencyNote?: string;
  isPayable: boolean;
  monthsToDebtFree: number | null;
  debtFreeDate: string | null;
  totalInterest: number;
  totalPaid: number;
  startingBalance: number;
  monthlyMinimumTotal: number;
  averageMonthlyPayment: number | null;
  schedule: DebtPayoffMonthStep[];
  debtSummaries: DebtPayoffDebtSummary[];
  /** True when the plan hit maxMonths without finishing. */
  hitMonthCap: boolean;
  warnings: string[];
}

export interface DebtPayoffStrategyComparison {
  avalanche: DebtPayoffSimulationResult;
  snowball: DebtPayoffSimulationResult;
  interestSavedByAvalanche: number | null;
  monthsSavedByAvalanche: number | null;
}
