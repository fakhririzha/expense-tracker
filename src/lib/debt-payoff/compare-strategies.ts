import { simulateDebtPayoff } from "@/lib/debt-payoff/simulate-debt-payoff";
import type {
  DebtPayoffInputDebt,
  DebtPayoffStrategyComparison,
} from "@/lib/debt-payoff/types";

/**
 * Run avalanche and snowball simulations on the same debts for side-by-side comparison.
 */
export function compareDebtPayoffStrategies(args: {
  debts: DebtPayoffInputDebt[];
  extraMonthlyAmount: number;
  startDate?: Date;
  maxMonths?: number;
}): DebtPayoffStrategyComparison {
  const shared = {
    debts: args.debts,
    extraMonthlyAmount: args.extraMonthlyAmount,
    startDate: args.startDate,
    maxMonths: args.maxMonths,
  };

  const avalanche = simulateDebtPayoff({
    ...shared,
    strategy: "AVALANCHE",
  });
  const snowball = simulateDebtPayoff({
    ...shared,
    strategy: "SNOWBALL",
  });

  const interestSavedByAvalanche =
    avalanche.isPayable && snowball.isPayable
      ? Math.round((snowball.totalInterest - avalanche.totalInterest) * 100) / 100
      : null;

  const monthsSavedByAvalanche =
    avalanche.monthsToDebtFree !== null && snowball.monthsToDebtFree !== null
      ? snowball.monthsToDebtFree - avalanche.monthsToDebtFree
      : null;

  return {
    avalanche,
    snowball,
    interestSavedByAvalanche,
    monthsSavedByAvalanche,
  };
}
