"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { getExchangeRate, getMultipleAssetPrices } from "@/lib/finance-service";
import {
  type ExecutiveMetrics,
  HEALTH_TIERS,
  type HealthTier,
} from "./executive-types";

interface AccountData {
  type: string;
  balance: number;
  currency: string;
}

interface AssetData {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  currency: string;
}

interface TransactionData {
  type: string;
  amount: number;
  exchangeRate: number;
  date: Date;
}

export async function getExecutiveMetrics(): Promise<{
  success: boolean;
  error?: string;
  data?: ExecutiveMetrics;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get user with preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        mainCurrency: true,
        retirementTarget: true,
        monthlyBudget: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const mainCurrency = user.mainCurrency;

    // Fetch all accounts
    const accounts = await prisma.financialAccount.findMany({
      where: { userId: session.user.id, isActive: true },
    });

    // Fetch all investment assets
    const investmentAssets = await prisma.investmentAsset.findMany({
      where: { userId: session.user.id },
    });

    // Fetch transactions for the last 6 months for expense/income analysis
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: { gte: sixMonthsAgo },
      },
    });

    // Fetch realized PnL
    const realizedPnLResult = await prisma.tradeHistory.aggregate({
      where: {
        userId: session.user.id,
        type: "SELL",
        realizedPnL: { not: null },
      },
      _sum: { realizedPnL: true },
    });

    // Calculate account totals (normalized to main currency)
    let totalCash = 0;
    let totalSavings = 0;
    let totalDebt = 0;

    for (const account of accounts as AccountData[]) {
      const rate =
        account.currency === mainCurrency
          ? 1
          : (await getExchangeRate(account.currency, mainCurrency)) ?? 1;

      const normalizedBalance = account.balance * rate;

      switch (account.type) {
        case "CASH":
          totalCash += normalizedBalance;
          break;
        case "BANK":
          totalSavings += normalizedBalance;
          break;
        case "LOAN":
        case "CREDIT_CARD":
          totalDebt += Math.abs(normalizedBalance);
          break;
      }
    }

    // Calculate investment values
    let investmentValue = 0;
    let investmentCost = 0;

    if (investmentAssets.length > 0) {
      const symbols = investmentAssets.map((a: AssetData) => a.symbol);
      const prices = await getMultipleAssetPrices(symbols);

      for (const asset of investmentAssets as AssetData[]) {
        const quote = prices.get(asset.symbol);
        const currentPrice = quote?.regularMarketPrice ?? asset.avgBuyPrice;

        const assetRate =
          asset.currency === mainCurrency
            ? 1
            : (await getExchangeRate(asset.currency, mainCurrency)) ?? 1;

        investmentValue += asset.quantity * currentPrice * assetRate;
        investmentCost += asset.quantity * asset.avgBuyPrice * assetRate;
      }
    }

    const totalUnrealizedPnL = investmentValue - investmentCost;
    const totalRealizedPnL = realizedPnLResult._sum.realizedPnL ?? 0;

    // Calculate monthly averages from transactions
    let totalExpenses = 0;
    let totalIncome = 0;
    const expenseMonths = new Set<string>();
    const incomeMonths = new Set<string>();

    for (const tx of transactions as TransactionData[]) {
      const normalizedAmount = tx.amount * tx.exchangeRate;
      const monthKey = `${tx.date.getFullYear()}-${tx.date.getMonth()}`;

      if (tx.type === "EXPENSE") {
        totalExpenses += normalizedAmount;
        expenseMonths.add(monthKey);
      } else if (tx.type === "INCOME") {
        totalIncome += normalizedAmount;
        incomeMonths.add(monthKey);
      }
    }

    const avgMonthlyExpenses =
      expenseMonths.size > 0 ? totalExpenses / expenseMonths.size : 0;
    const avgMonthlyIncome =
      incomeMonths.size > 0 ? totalIncome / incomeMonths.size : 0;

    // Calculate key metrics
    const totalAssets = totalCash + totalSavings + investmentValue;
    const netWorth = totalAssets - totalDebt;
    const liquidAssets = totalCash + totalSavings;

    const debtToWealthRatio =
      totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
    const liquidityRatio =
      avgMonthlyExpenses > 0 ? liquidAssets / avgMonthlyExpenses : 0;
    const savingsRate =
      avgMonthlyIncome > 0
        ? ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome) * 100
        : 0;
    const monthsOfRunway =
      avgMonthlyExpenses > 0 ? liquidAssets / avgMonthlyExpenses : 0;

    // Determine health tier
    const healthTier = calculateHealthTier(
      netWorth,
      debtToWealthRatio,
      monthsOfRunway
    );

    // Calculate retirement progress
    const retirementTarget = user.retirementTarget;
    const retirementProgress =
      retirementTarget && retirementTarget > 0
        ? Math.min((netWorth / retirementTarget) * 100, 100)
        : 0;

    return {
      success: true,
      data: {
        totalCash,
        totalSavings,
        totalInvestments: investmentValue,
        totalDebt,
        netWorth,
        debtToWealthRatio,
        liquidityRatio,
        healthTier,
        healthTierInfo: HEALTH_TIERS[healthTier],
        avgMonthlyExpenses,
        avgMonthlyIncome,
        savingsRate,
        monthsOfRunway,
        investmentValue,
        investmentCost,
        totalUnrealizedPnL,
        totalRealizedPnL,
        retirementTarget,
        retirementProgress,
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

export async function updateUserPreferences(data: {
  mainCurrency?: string;
  retirementTarget?: number;
  monthlyBudget?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data,
    });

    return { success: true };
  } catch (error) {
    console.error("Update user preferences error:", error);
    return { success: false, error: "Failed to update preferences" };
  }
}
