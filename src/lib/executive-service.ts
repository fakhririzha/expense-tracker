import "server-only";

import { cache } from "react";

import {
  AccountType,
  Prisma,
} from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import { getCurrentPortfolioValuation } from "@/lib/investment-valuation-service";
import { averageMonthlyNormalizedAmount } from "@/lib/transaction-aggregates";
import { calculateRetirementProjection } from "@/lib/retirement-projection";
import {
  type ExecutiveMetrics,
  HEALTH_TIERS,
  type HealthTier,
} from "./executive-types";

const executiveAccountSelect = {
  type: true,
  balance: true,
  currency: true,
} satisfies Prisma.FinancialAccountSelect;

const executivePersonalAssetSelect = {
  currentValue: true,
  currency: true,
} satisfies Prisma.PersonalAssetSelect;

type ExecutiveAccountRow = Prisma.FinancialAccountGetPayload<{
  select: typeof executiveAccountSelect;
}>;

type ExecutivePersonalAssetRow = Prisma.PersonalAssetGetPayload<{
  select: typeof executivePersonalAssetSelect;
}>;

function getDistinctSourceCurrencies(
  mainCurrency: string,
  accounts: ExecutiveAccountRow[],
  personalAssets: ExecutivePersonalAssetRow[]
): string[] {
  return [...new Set(
    [...accounts, ...personalAssets]
      .map((item) => item.currency)
      .filter((currency) => currency !== mainCurrency)
  )];
}

async function getConversionRatesForCurrency(
  sourceCurrencies: string[],
  targetCurrency: string
): Promise<{
  rates: Map<string, number>;
  missingCurrencies: string[];
}> {
  const rateResults = await Promise.all(
    sourceCurrencies.map(async (currency) => ({
      currency,
      rate: await getExchangeRate(currency, targetCurrency),
    }))
  );

  return {
    rates: new Map(
      rateResults.map(({ currency, rate }) => [currency, rate ?? 1])
    ),
    missingCurrencies: rateResults
      .filter(({ rate }) => rate === null)
      .map(({ currency }) => currency),
  };
}

function normalizeToCurrency(
  amount: number,
  currency: string,
  mainCurrency: string,
  conversionRates: Map<string, number>
): number {
  if (currency === mainCurrency) {
    return amount;
  }

  return amount * (conversionRates.get(currency) ?? 1);
}

async function loadExecutiveMetricsForUser(userId: string): Promise<{
  success: boolean;
  error?: string;
  data?: ExecutiveMetrics;
}> {
  try {
    // Get user with preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        mainCurrency: true,
        retirementTarget: true,
        monthlyBudget: true,
        dateOfBirth: true,
        retirementAge: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const mainCurrency = user.mainCurrency;

    // Fetch transactions for the last 6 months for expense/income analysis
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [accounts, personalAssets, monthlyAverages] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId, isActive: true },
        select: executiveAccountSelect,
      }),
      prisma.personalAsset.findMany({
        where: { userId, disposedAt: null },
        select: executivePersonalAssetSelect,
      }),
      averageMonthlyNormalizedAmount({
        userId,
        from: sixMonthsAgo,
      }),
    ]);

    const sourceCurrencies = getDistinctSourceCurrencies(
      mainCurrency,
      accounts,
      personalAssets
    );
    const { rates: conversionRates, missingCurrencies } =
      await getConversionRatesForCurrency(
        sourceCurrencies,
        mainCurrency
      );
    const currencyConversionError =
      missingCurrencies.length > 0
        ? `Currency conversion is unavailable for ${missingCurrencies.join(", ")}.`
        : null;

    // Calculate account totals (normalized to main currency)
    let totalCash = 0;
    let totalSavings = 0;
    let totalInvestmentCash = 0;
    let totalDepositos = 0;
    let totalLoanReceivables = 0;
    let totalDebt = 0;

    for (const account of accounts) {
      const normalizedBalance = normalizeToCurrency(
        account.balance,
        account.currency,
        mainCurrency,
        conversionRates
      );

      switch (account.type) {
        case AccountType.CASH:
          totalCash += normalizedBalance;
          break;
        case AccountType.BANK:
          totalSavings += normalizedBalance;
          break;
        case AccountType.INVESTMENT:
          totalInvestmentCash += normalizedBalance;
          break;
        case AccountType.DEPOSITO:
          totalDepositos += normalizedBalance;
          break;
        case AccountType.LOAN_RECEIVABLE:
          totalLoanReceivables += normalizedBalance;
          break;
        case AccountType.LOAN:
        case AccountType.CREDIT_CARD:
          totalDebt += Math.abs(normalizedBalance);
          break;
      }
    }

    let portfolioSummary: ExecutiveMetrics["portfolioSummary"] = null;
    let valuationError: string | null = null;
    try {
      const portfolio = await getCurrentPortfolioValuation(
        userId,
        mainCurrency
      );
      portfolioSummary = portfolio.summary;
    } catch (error) {
      console.error("Get executive portfolio valuation error:", error);
      valuationError =
        error instanceof Error
          ? error.message
          : "Current investment valuation is unavailable";
    }

    let totalPersonalAssets = 0;
    for (const asset of personalAssets) {
      totalPersonalAssets += normalizeToCurrency(
        asset.currentValue,
        asset.currency,
        mainCurrency,
        conversionRates
      );
    }

    const avgMonthlyExpenses = monthlyAverages.expense;
    const avgMonthlyIncome = monthlyAverages.income;

    // Calculate key metrics
    const totalAssets = portfolioSummary
      ? totalCash +
        totalSavings +
        totalInvestmentCash +
        totalDepositos +
        totalLoanReceivables +
        portfolioSummary.totalValue +
        totalPersonalAssets
      : null;
    const netWorth = totalAssets === null ? null : totalAssets - totalDebt;
    const liquidAssets = totalCash + totalSavings;

    const debtToWealthRatio =
      totalAssets === null ? null : totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
    const liquidityRatio =
      avgMonthlyExpenses > 0 ? liquidAssets / avgMonthlyExpenses : 0;
    const savingsRate =
      avgMonthlyIncome > 0
        ? ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome) * 100
        : 0;
    const monthsOfRunway =
      avgMonthlyExpenses > 0 ? liquidAssets / avgMonthlyExpenses : 0;

    // Determine health tier
    const healthTier =
      netWorth === null || debtToWealthRatio === null
        ? null
        : calculateHealthTier(netWorth, debtToWealthRatio, monthsOfRunway);

    // Calculate retirement progress
    const retirementTarget = user.retirementTarget;
    const retirementProgress =
      netWorth !== null && retirementTarget && retirementTarget > 0
        ? Math.min((netWorth / retirementTarget) * 100, 100)
        : netWorth === null
          ? null
          : 0;
    const retirementProjection = calculateRetirementProjection({
      retirementTarget,
      currentNetWorth: netWorth,
      dateOfBirth: user.dateOfBirth,
      retirementAge: user.retirementAge,
    });

    return {
      success: true,
      data: {
        totalCash,
        totalSavings,
        totalInvestmentCash,
        totalDepositos,
        totalInvestments: portfolioSummary?.totalValue ?? null,
        totalPersonalAssets,
        totalLoanReceivables,
        totalDebt,
        totalAssets,
        netWorth,
        debtToWealthRatio,
        liquidityRatio,
        healthTier,
        healthTierInfo: healthTier ? HEALTH_TIERS[healthTier] : null,
        avgMonthlyExpenses,
        avgMonthlyIncome,
        savingsRate,
        monthsOfRunway,
        investmentValue: portfolioSummary?.totalValue ?? null,
        investmentCost: portfolioSummary?.totalCost ?? null,
        totalUnrealizedPnL: portfolioSummary?.totalUnrealizedPnL ?? null,
        totalRealizedPnL: portfolioSummary?.totalRealizedPnL ?? null,
        portfolioSummary,
        valuationError,
        currencyConversionError,
        retirementTarget,
        retirementProgress,
        retirementProjection,
        monthlyBudget: user.monthlyBudget,
        displayCurrency: mainCurrency,
      },
    };
  } catch (error) {
    console.error("Get executive metrics error:", error);
    return { success: false, error: "Failed to fetch executive metrics" };
  }
}

function calculateHealthTier(
  netWorth: number,
  debtToWealthRatio: number,
  monthsOfRunway: number
): HealthTier {
  // F-Tier: Negative Net Worth
  if (netWorth < 0) {
    return "F";
  }

  // S-Tier: Debt < 10% AND 6+ months emergency fund
  if (debtToWealthRatio < 10 && monthsOfRunway >= 6) {
    return "S";
  }

  // A-Tier: Debt < 30%
  if (debtToWealthRatio < 30) {
    return "A";
  }

  // B-Tier: Debt < 60%
  if (debtToWealthRatio < 60) {
    return "B";
  }

  // C-Tier: Debt < 100%
  if (debtToWealthRatio < 100) {
    return "C";
  }

  // Default to F if none match
  return "F";
}

export const getExecutiveMetricsForUser = cache(loadExecutiveMetricsForUser);
