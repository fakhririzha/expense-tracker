import { getExchangeRate } from "@/lib/finance-service";

export interface GoalAccountBalanceInput {
  id: string;
  balance: number;
  currency: string;
}

export interface GoalAccountContribution {
  id: string;
  balance: number;
  currency: string;
  /** Balance converted to the user's main currency (non-negative for progress). */
  balanceInMain: number;
  exchangeRate: number;
}

export interface GoalProgressResult {
  currentAmount: number;
  percentage: number;
  remaining: number;
  isCompleted: boolean;
  accounts: GoalAccountContribution[];
}

/**
 * Convert an account balance to the target currency.
 * Falls back to rate 1 when FX data is unavailable (same pattern as account summary).
 */
export async function convertBalanceToMainCurrency(
  amount: number,
  fromCurrency: string,
  mainCurrency: string
): Promise<{ converted: number; rate: number }> {
  if (fromCurrency === mainCurrency) {
    return { converted: amount, rate: 1 };
  }

  const rate = (await getExchangeRate(fromCurrency, mainCurrency)) ?? 1;
  return { converted: amount * rate, rate };
}

/**
 * Derive goal progress from linked account balances converted to main currency.
 * Negative balances contribute 0 so progress never goes below zero.
 */
export async function computeGoalProgress(input: {
  targetAmount: number;
  mainCurrency: string;
  accounts: GoalAccountBalanceInput[];
}): Promise<GoalProgressResult> {
  const contributions: GoalAccountContribution[] = [];

  for (const account of input.accounts) {
    const { converted, rate } = await convertBalanceToMainCurrency(
      account.balance,
      account.currency,
      input.mainCurrency
    );
    const balanceInMain = Math.max(0, converted);

    contributions.push({
      id: account.id,
      balance: account.balance,
      currency: account.currency,
      balanceInMain,
      exchangeRate: rate,
    });
  }

  const currentAmount = contributions.reduce(
    (sum, account) => sum + account.balanceInMain,
    0
  );
  const targetAmount = input.targetAmount;
  const percentage =
    targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
  const remaining = targetAmount - currentAmount;
  const isCompleted = targetAmount > 0 && currentAmount >= targetAmount;

  return {
    currentAmount,
    percentage,
    remaining,
    isCompleted,
    accounts: contributions,
  };
}
