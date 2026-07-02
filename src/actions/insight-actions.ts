"use server";

import {
  BudgetPeriod,
  PaymentStatus,
  SubscriptionStatus,
  type TransactionType,
} from "@/generated/prisma/client/client";
import { addDays, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { z } from "zod";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import {
  createInsightCurrencyConverter,
  normalizeTransactionAmount,
} from "@/lib/financial-insights/insight-currency-utils";
import { flattenTransactionAllocationRows } from "@/lib/transaction-allocation-service";
import {
  generateFinancialInsights,
  type FinancialInsightComputationContext,
  type InsightBudgetProgress,
  type InsightCategorySpendComparison,
  type InsightGoalProgress,
  type InsightNetWorthMovement,
  type InsightPortfolioAllocation,
  type InsightUnusualTransactionCandidate,
} from "@/lib/financial-insights/generate-financial-insights";
import {
  countRecurringOccurrencesWithinRange,
  getCurrentMonthToDateRange,
  getDaysBetween,
  getInactiveAccountLookbackStart,
  getInsightPeriodKey,
  getPreviousComparableMonthRange,
  getSixMonthLookbackStart,
  toInsightPeriod,
} from "@/lib/financial-insights/insight-date-utils";
import {
  FINANCIAL_INSIGHT_LIMITS,
  UNUSUAL_TRANSACTION_MIN_SAMPLES,
} from "@/lib/financial-insights/insight-thresholds";
import { type FinancialInsightResponse } from "@/lib/financial-insights/insight-types";
import {
  isAssetAccountType,
  isLiquidAccountType,
  normalizeAccountBalanceForType,
} from "@/lib/account-types";
import { getCurrentPortfolioValuation } from "@/lib/investment-valuation-service";
import {
  billingCycleToRecurringInterval,
  isRenewalEligibleSubscriptionStatus,
  resolveSubscriptionStatus,
} from "@/lib/subscription-utils";
import { decryptUserField } from "@/lib/user-encryption";

const insightTypeSchema = z.enum([
  "budget_warning",
  "spending_spike",
  "spending_reduction",
  "cash_flow_risk",
  "debt_pressure",
  "goal_progress",
  "emergency_fund",
  "net_worth_movement",
  "inactive_account",
  "high_category_spending",
  "unusual_transaction",
  "positive_monthly_progress",
  "investment_allocation",
  "multi_currency_impact",
]);

const getFinancialInsightsSchema = z
  .object({
    scope: z.enum(["dashboard"]).optional(),
    limit: z.number().int().min(1).max(12).optional(),
    includeTypes: z.array(insightTypeSchema).optional(),
  })
  .optional();

export type GetFinancialInsightsInput = z.infer<typeof getFinancialInsightsSchema>;

function getBudgetRange(period: BudgetPeriod, now: Date) {
  switch (period) {
    case BudgetPeriod.MONTHLY:
      return { start: startOfMonth(now), end: now };
    case BudgetPeriod.QUARTERLY:
      return { start: startOfQuarter(now), end: now };
    case BudgetPeriod.YEARLY:
      return { start: startOfYear(now), end: now };
    default:
      return { start: startOfMonth(now), end: now };
  }
}

function getBudgetQueryFloor(now: Date): Date {
  return new Date(
    Math.min(
      startOfYear(now).getTime(),
      getInactiveAccountLookbackStart(now).getTime(),
      getSixMonthLookbackStart(now).getTime(),
      getPreviousComparableMonthRange(now).from.getTime()
    )
  );
}

async function decryptGoalNames(
  userId: string,
  goals: Array<{ id: string; name: string; nameEncrypted: string | null }>
): Promise<Map<string, string>> {
  const pairs = await Promise.all(
    goals.map(async (goal) => {
      if (!goal.nameEncrypted) {
        return [goal.id, goal.name] as const;
      }

      try {
        const decrypted = await decryptUserField(
          userId,
          "savingsGoal.name",
          goal.nameEncrypted
        );
        return [goal.id, decrypted] as const;
      } catch {
        return [goal.id, goal.name] as const;
      }
    })
  );

  return new Map(pairs);
}

function buildBudgetProgress(input: {
  budgets: Array<{
    id: string;
    name: string;
    amount: number;
    period: BudgetPeriod;
    startDate: Date;
    endDate: Date | null;
    categoryId: string | null;
    category: { id: string; name: string } | null;
  }>;
  transactions: Array<{
    amount: number;
    exchangeRate: number;
    type: TransactionType;
    date: Date;
    categoryId: string | null;
  }>;
  expenseAllocations: Array<{
    normalizedAmount: number;
    date: Date;
    categoryId: string | null;
  }>;
  now: Date;
}): InsightBudgetProgress[] {
  return input.budgets
    .filter(
      (budget) =>
        budget.startDate <= input.now &&
        (!budget.endDate || budget.endDate >= input.now)
    )
    .map((budget) => {
      const range = getBudgetRange(budget.period, input.now);
      const spent = budget.categoryId
        ? input.expenseAllocations.reduce((sum, transaction) => {
            if (transaction.date < range.start || transaction.date > range.end) {
              return sum;
            }

            if (transaction.categoryId !== budget.categoryId) {
              return sum;
            }

            return sum + transaction.normalizedAmount;
          }, 0)
        : input.transactions.reduce((sum, transaction) => {
            if (transaction.date < range.start || transaction.date > range.end) {
              return sum;
            }

            if (
              transaction.type !== "EXPENSE" &&
              transaction.type !== "LIABILITY_PAYMENT"
            ) {
              return sum;
            }

            return sum + normalizeTransactionAmount(transaction);
          }, 0);

      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      return {
        id: budget.id,
        name: budget.name,
        amount: budget.amount,
        spent,
        percentage,
        categoryId: budget.categoryId,
        categoryName: budget.category?.name ?? null,
      };
    });
}

function buildCategoryComparisons(input: {
  currentTransactions: Array<{
    normalizedAmount: number;
    categoryId: string | null;
    category: { id: string; name: string } | null;
  }>;
  previousTransactions: Array<{
    normalizedAmount: number;
    categoryId: string | null;
    category: { id: string; name: string } | null;
  }>;
  currentMonthExpense: number;
}): InsightCategorySpendComparison[] {
  const byCategory = new Map<
    string,
    {
      categoryId: string | null;
      categoryName: string;
      currentAmount: number;
      previousAmount: number;
    }
  >();

  const upsert = (
    bucket: "currentAmount" | "previousAmount",
    transaction: {
      normalizedAmount: number;
      categoryId: string | null;
      category: { id: string; name: string } | null;
    }
  ) => {
    const key = transaction.categoryId ?? "uncategorized";
    const entry = byCategory.get(key) ?? {
      categoryId: transaction.categoryId,
      categoryName: transaction.category?.name ?? "Uncategorized",
      currentAmount: 0,
      previousAmount: 0,
    };
    entry[bucket] += transaction.normalizedAmount;
    byCategory.set(key, entry);
  };

  for (const transaction of input.currentTransactions) {
    upsert("currentAmount", transaction);
  }

  for (const transaction of input.previousTransactions) {
    upsert("previousAmount", transaction);
  }

  return Array.from(byCategory.values())
    .filter((entry) => entry.currentAmount > 0 || entry.previousAmount > 0)
    .map((entry) => ({
      ...entry,
      currentShare:
        input.currentMonthExpense > 0
          ? entry.currentAmount / input.currentMonthExpense
          : 0,
    }))
    .sort((left, right) => right.currentAmount - left.currentAmount);
}

function buildUnusualTransactionCandidates(input: {
  currentExpenseTransactions: Array<{
    id: string;
    amount: number;
    exchangeRate: number;
    categoryId: string | null;
    category: { id: string; name: string } | null;
  }>;
  lookbackExpenseTransactions: Array<{
    id: string;
    amount: number;
    exchangeRate: number;
    categoryId: string | null;
    category: { id: string; name: string } | null;
  }>;
}): InsightUnusualTransactionCandidate[] {
  const historyByCategory = new Map<
    string,
    Array<{ id: string; amount: number }>
  >();

  for (const transaction of input.lookbackExpenseTransactions) {
    const key = transaction.categoryId ?? "uncategorized";
    const bucket = historyByCategory.get(key) ?? [];
    bucket.push({
      id: transaction.id,
      amount: normalizeTransactionAmount(transaction),
    });
    historyByCategory.set(key, bucket);
  }

  return input.currentExpenseTransactions
    .map((transaction) => {
      const key = transaction.categoryId ?? "uncategorized";
      const history = (historyByCategory.get(key) ?? []).filter(
        (entry) => entry.id !== transaction.id
      );
      if (history.length < UNUSUAL_TRANSACTION_MIN_SAMPLES) {
        return null;
      }

      const baselineAverage =
        history.reduce((sum, entry) => sum + entry.amount, 0) / history.length;
      const amount = normalizeTransactionAmount(transaction);

      return {
        transactionId: transaction.id,
        categoryName: transaction.category?.name ?? "Uncategorized",
        amount,
        baselineAverage,
        multiplier: baselineAverage > 0 ? amount / baselineAverage : 0,
        sampleCount: history.length,
      };
    })
    .filter((candidate): candidate is InsightUnusualTransactionCandidate => candidate !== null);
}

function buildGoalProgress(input: {
  goals: Array<{
    id: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: Date | null;
    createdAt: Date;
  }>;
  goalNames: Map<string, string>;
  now: Date;
}): InsightGoalProgress[] {
  return input.goals
    .filter((goal) => !!goal.targetDate && goal.targetAmount > 0)
    .map((goal) => {
      const completionRatio = Math.min(goal.currentAmount / goal.targetAmount, 1);
      const totalDays = Math.max(
        1,
        getDaysBetween(goal.createdAt, goal.targetDate as Date)
      );
      const elapsedDays = Math.min(
        totalDays,
        getDaysBetween(goal.createdAt, input.now)
      );
      const expectedRatio = Math.min(elapsedDays / totalDays, 1);
      const gapRatio = Math.max(0, expectedRatio - completionRatio);

      return {
        id: goal.id,
        name: input.goalNames.get(goal.id) ?? "Savings goal",
        completionRatio,
        expectedRatio,
        gapRatio,
      };
    });
}

function buildNetWorthMovement(
  snapshots: Array<{
    snapshotDate: Date;
    currency: string;
    netWorth: { toNumber(): number };
  }>
): InsightNetWorthMovement | null {
  if (snapshots.length < 2) {
    return null;
  }

  const [latest, previous] = snapshots;
  if (latest.currency !== previous.currency) {
    return null;
  }

  const currentNetWorth = latest.netWorth.toNumber();
  const previousNetWorth = previous.netWorth.toNumber();
  const changeAmount = currentNetWorth - previousNetWorth;
  const changePercent =
    previousNetWorth !== 0 ? changeAmount / previousNetWorth : 0;

  return {
    currentNetWorth,
    previousNetWorth,
    changeAmount,
    changePercent,
    currency: latest.currency,
    fromDate: previous.snapshotDate.toISOString(),
    toDate: latest.snapshotDate.toISOString(),
  };
}

function buildPortfolioAllocation(input: {
  portfolio:
    | Awaited<ReturnType<typeof getCurrentPortfolioValuation>>
    | null;
  normalizedAssetBase: number;
}): InsightPortfolioAllocation | null {
  if (!input.portfolio || input.portfolio.summary.totalValue <= 0) {
    return null;
  }

  const totalAssetBase =
    input.normalizedAssetBase + input.portfolio.summary.totalValue;
  if (totalAssetBase <= 0) {
    return null;
  }

  const largestHolding = input.portfolio.assets
    .filter((asset) => asset.quantity > 0)
    .sort((left, right) => right.currentValue - left.currentValue)[0];

  return {
    totalPortfolioValue: input.portfolio.summary.totalValue,
    totalAssetBase,
    investmentExposureRatio:
      input.portfolio.summary.totalValue / totalAssetBase,
    largestHoldingSymbol: largestHolding?.symbol ?? null,
    largestHoldingValue: largestHolding?.currentValue ?? 0,
    largestHoldingRatio:
      largestHolding && input.portfolio.summary.totalValue > 0
        ? largestHolding.currentValue / input.portfolio.summary.totalValue
        : 0,
  };
}

export async function getFinancialInsights(
  input?: GetFinancialInsightsInput
): Promise<{ success: boolean; data?: FinancialInsightResponse; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = getFinancialInsightsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid insight request",
      };
    }

    const scope = parsed.data?.scope ?? "dashboard";
    const limit = parsed.data?.limit ?? FINANCIAL_INSIGHT_LIMITS[scope];
    const includeTypes = parsed.data?.includeTypes;
    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mainCurrency: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const currentPeriod = getCurrentMonthToDateRange(now);
    const previousPeriod = getPreviousComparableMonthRange(now);
    const lookbackStart = getSixMonthLookbackStart(now);
    const upcomingWindowEnd = addDays(now, 30);
    const queryFloor = getBudgetQueryFloor(now);

    const [
      accounts,
      personalAssets,
      budgets,
      goals,
      recurringRules,
      subscriptions,
      transactions,
      netWorthSnapshots,
      portfolioResult,
    ] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId: session.user.id, isActive: true },
        select: {
          id: true,
          type: true,
          balance: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.personalAsset.findMany({
        where: { userId: session.user.id, disposedAt: null },
        select: {
          currentValue: true,
          currency: true,
        },
      }),
      prisma.budget.findMany({
        where: { userId: session.user.id, isActive: true },
        select: {
          id: true,
          name: true,
          amount: true,
          period: true,
          startDate: true,
          endDate: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.savingsGoal.findMany({
        where: { userId: session.user.id, isCompleted: false },
        select: {
          id: true,
          name: true,
          nameEncrypted: true,
          targetAmount: true,
          currentAmount: true,
          targetDate: true,
          createdAt: true,
        },
      }),
      prisma.recurringRule.findMany({
        where: {
          userId: session.user.id,
          isActive: true,
          type: "EXPENSE",
          nextDueDate: { lte: upcomingWindowEnd },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          interval: true,
          nextDueDate: true,
          endDate: true,
        },
      }),
      prisma.subscription.findMany({
        where: {
          userId: session.user.id,
          recurringRuleId: null,
          nextBillingDate: { lte: upcomingWindowEnd },
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.CANCELLED],
          },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          billingCycle: true,
          nextBillingDate: true,
          trialEndDate: true,
          cancellationDate: true,
          status: true,
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: session.user.id,
          date: {
            gte: queryFloor,
            lte: now,
          },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          exchangeRate: true,
          type: true,
          paymentStatus: true,
          date: true,
          categoryId: true,
          accountId: true,
          toAccountId: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          splits: {
            select: {
              id: true,
              amount: true,
              description: true,
              sortOrder: true,
              categoryId: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  icon: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: {
          date: "asc",
        },
      }),
      prisma.netWorthSnapshot.findMany({
        where: { userId: session.user.id },
        select: {
          snapshotDate: true,
          currency: true,
          netWorth: true,
        },
        orderBy: { snapshotDate: "desc" },
        take: 2,
      }),
      getCurrentPortfolioValuation(
        session.user.id,
        user.mainCurrency
      ).catch(() => null),
    ]);

    const mainCurrency = user.mainCurrency;
    const converter = await createInsightCurrencyConverter({
      targetCurrency: mainCurrency,
      sourceCurrencies: [
        ...accounts.map((account) => account.currency),
        ...personalAssets.map((asset) => asset.currency),
        ...recurringRules.map((rule) => rule.currency),
        ...subscriptions.map((subscription) => subscription.currency),
      ],
    });

    let liquidAssetsValue = 0;
    let liquidAssetsMissingRate = false;
    let assetBaseForPortfolio = 0;
    let totalTrackedAssetValue = 0;
    let nonMainAssetValue = 0;

    for (const account of accounts) {
      const normalizedBalance = normalizeAccountBalanceForType(
        account.type,
        account.balance
      );
      if (!isAssetAccountType(account.type)) {
        continue;
      }

      const conversion = await converter.convert(normalizedBalance, account.currency);
      if (conversion.amount === null) {
        if (isLiquidAccountType(account.type)) {
          liquidAssetsMissingRate = true;
        }
        continue;
      }

      assetBaseForPortfolio += conversion.amount;
      totalTrackedAssetValue += conversion.amount;

      if (account.currency !== mainCurrency) {
        nonMainAssetValue += conversion.amount;
      }

      if (isLiquidAccountType(account.type)) {
        liquidAssetsValue += conversion.amount;
      }
    }

    for (const asset of personalAssets) {
      const conversion = await converter.convert(asset.currentValue, asset.currency);
      if (conversion.amount === null) {
        continue;
      }

      assetBaseForPortfolio += conversion.amount;
      totalTrackedAssetValue += conversion.amount;

      if (asset.currency !== mainCurrency) {
        nonMainAssetValue += conversion.amount;
      }
    }

    if (portfolioResult) {
      totalTrackedAssetValue += portfolioResult.summary.totalValue;
      for (const asset of portfolioResult.assets.filter((portfolioAsset) => portfolioAsset.quantity > 0)) {
        if (asset.currency !== mainCurrency) {
          nonMainAssetValue += asset.currentValue;
        }
      }
    }

    const currentExpenseTransactions = transactions.filter(
      (transaction) =>
        transaction.type === "EXPENSE" &&
        transaction.date >= currentPeriod.from &&
        transaction.date <= currentPeriod.to
    );
    const previousExpenseTransactions = transactions.filter(
      (transaction) =>
        transaction.type === "EXPENSE" &&
        transaction.date >= previousPeriod.from &&
        transaction.date <= previousPeriod.to
    );
    const lookbackExpenseTransactions = transactions.filter(
      (transaction) =>
        transaction.type === "EXPENSE" &&
        transaction.date >= lookbackStart &&
        transaction.date <= currentPeriod.to
    );

    const currentIncomeTransactions = transactions.filter(
      (transaction) =>
        transaction.type === "INCOME" &&
        transaction.date >= currentPeriod.from &&
        transaction.date <= currentPeriod.to
    );
    const previousIncomeTransactions = transactions.filter(
      (transaction) =>
        transaction.type === "INCOME" &&
        transaction.date >= previousPeriod.from &&
        transaction.date <= previousPeriod.to
    );
    const currentLiabilityPayments = transactions.filter(
      (transaction) =>
        transaction.type === "LIABILITY_PAYMENT" &&
        transaction.paymentStatus === PaymentStatus.COMPLETED &&
        transaction.date >= currentPeriod.from &&
        transaction.date <= currentPeriod.to
    );
    const expenseAllocationRows = flattenTransactionAllocationRows(
      transactions.filter((transaction) => transaction.type === "EXPENSE")
    );
    const currentExpenseAllocations = expenseAllocationRows.filter(
      (transaction) =>
        transaction.date >= currentPeriod.from && transaction.date <= currentPeriod.to
    );
    const previousExpenseAllocations = expenseAllocationRows.filter(
      (transaction) =>
        transaction.date >= previousPeriod.from && transaction.date <= previousPeriod.to
    );

    const currentMonthExpense = currentExpenseTransactions.reduce(
      (sum, transaction) => sum + normalizeTransactionAmount(transaction),
      0
    );
    const currentMonthIncome = currentIncomeTransactions.reduce(
      (sum, transaction) => sum + normalizeTransactionAmount(transaction),
      0
    );
    const previousComparableExpense = previousExpenseTransactions.reduce(
      (sum, transaction) => sum + normalizeTransactionAmount(transaction),
      0
    );
    const previousComparableIncome = previousIncomeTransactions.reduce(
      (sum, transaction) => sum + normalizeTransactionAmount(transaction),
      0
    );
    const currentMonthLiabilityPayments = currentLiabilityPayments.reduce(
      (sum, transaction) => sum + normalizeTransactionAmount(transaction),
      0
    );

    const monthExpenseTotals = new Map<string, number>();
    for (const transaction of lookbackExpenseTransactions) {
      const key = `${transaction.date.getFullYear()}-${transaction.date.getMonth()}`;
      monthExpenseTotals.set(
        key,
        (monthExpenseTotals.get(key) ?? 0) + normalizeTransactionAmount(transaction)
      );
    }
    const avgMonthlyExpenses =
      monthExpenseTotals.size > 0
        ? Array.from(monthExpenseTotals.values()).reduce((sum, amount) => sum + amount, 0) /
          monthExpenseTotals.size
        : 0;

    const budgetProgress = buildBudgetProgress({
      budgets,
      transactions,
      expenseAllocations: expenseAllocationRows,
      now,
    });
    const categorySpending = buildCategoryComparisons({
      currentTransactions: currentExpenseAllocations,
      previousTransactions: previousExpenseAllocations,
      currentMonthExpense,
    });
    const unusualTransactions = buildUnusualTransactionCandidates({
      currentExpenseTransactions,
      lookbackExpenseTransactions,
    });

    const goalNames = await decryptGoalNames(session.user.id, goals);
    const goalProgress = buildGoalProgress({
      goals,
      goalNames,
      now,
    });

    const lastActivityByAccount = new Map<string, Date>();
    for (const transaction of transactions.filter(
      (item) => item.date >= getInactiveAccountLookbackStart(now)
    )) {
      const sourceDate = lastActivityByAccount.get(transaction.accountId);
      if (!sourceDate || transaction.date > sourceDate) {
        lastActivityByAccount.set(transaction.accountId, transaction.date);
      }
      if (transaction.toAccountId) {
        const targetDate = lastActivityByAccount.get(transaction.toAccountId);
        if (!targetDate || transaction.date > targetDate) {
          lastActivityByAccount.set(transaction.toAccountId, transaction.date);
        }
      }
    }

    let inactive90Count = 0;
    let inactive180Count = 0;
    let oldestDays: number | null = null;

    for (const account of accounts) {
      const lastActivity = lastActivityByAccount.get(account.id) ?? account.createdAt;
      const daysInactive = Math.floor(getDaysBetween(lastActivity, now));
      if (daysInactive >= 180) {
        inactive180Count += 1;
      } else if (daysInactive >= 90) {
        inactive90Count += 1;
      }

      if (daysInactive >= 90) {
        oldestDays = oldestDays === null ? daysInactive : Math.max(oldestDays, daysInactive);
      }
    }

    let upcomingCommittedExpenses = 0;
    let missingUpcomingConversion = false;

    for (const rule of recurringRules) {
      const conversion = await converter.convert(rule.amount, rule.currency);
      if (conversion.amount === null) {
        missingUpcomingConversion = true;
        continue;
      }

      const occurrences = countRecurringOccurrencesWithinRange({
        startDate: rule.nextDueDate,
        interval: rule.interval,
        rangeEnd: upcomingWindowEnd,
        endDate: rule.endDate,
      });
      upcomingCommittedExpenses += conversion.amount * occurrences;
    }

    for (const subscription of subscriptions) {
      const effectiveStatus = resolveSubscriptionStatus(subscription, now);
      if (!isRenewalEligibleSubscriptionStatus(effectiveStatus)) {
        continue;
      }

      const conversion = await converter.convert(
        subscription.amount,
        subscription.currency
      );
      if (conversion.amount === null) {
        missingUpcomingConversion = true;
        continue;
      }

      const occurrences = countRecurringOccurrencesWithinRange({
        startDate: subscription.nextBillingDate,
        interval: billingCycleToRecurringInterval(subscription.billingCycle),
        rangeEnd: upcomingWindowEnd,
        endDate:
          effectiveStatus === SubscriptionStatus.CANCELLED
            ? subscription.cancellationDate
            : null,
      });
      upcomingCommittedExpenses += conversion.amount * occurrences;
    }

    let nonMainExpenseValue = 0;
    for (const transaction of currentExpenseTransactions) {
      if (transaction.currency !== mainCurrency) {
        nonMainExpenseValue += normalizeTransactionAmount(transaction);
      }
    }

    const context: FinancialInsightComputationContext = {
      scope,
      limit,
      includeTypes,
      generatedAt: now.toISOString(),
      currency: mainCurrency,
      periodKey: getInsightPeriodKey(now),
      currentPeriod: toInsightPeriod(currentPeriod),
      previousPeriod: toInsightPeriod(previousPeriod),
      budgets: budgetProgress,
      categorySpending,
      currentMonthIncome,
      currentMonthExpense,
      previousComparableIncome,
      previousComparableExpense,
      currentMonthLiabilityPayments,
      liquidAssetsValue: liquidAssetsMissingRate ? null : liquidAssetsValue,
      upcomingCommittedExpenses: missingUpcomingConversion
        ? null
        : upcomingCommittedExpenses,
      avgMonthlyExpenses,
      goals: goalProgress,
      inactiveAccounts: {
        inactive90Count,
        inactive180Count,
        oldestDays,
      },
      unusualTransactions,
      netWorthMovement: buildNetWorthMovement(netWorthSnapshots),
      portfolioAllocation: buildPortfolioAllocation({
        portfolio: portfolioResult,
        normalizedAssetBase: assetBaseForPortfolio,
      }),
      multiCurrencyExposure: {
        nonMainAssetValue,
        totalTrackedAssetValue,
        nonMainExpenseValue,
        totalExpenseValue: currentMonthExpense,
        fallbackRateCount: converter.getStats().cachedRateCount,
      },
    };

    return {
      success: true,
      data: generateFinancialInsights(context),
    };
  } catch (error) {
    console.error("Get financial insights error:", error);
    return { success: false, error: "Failed to fetch financial insights" };
  }
}
