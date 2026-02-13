"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";

// ==================== TYPES ====================

export interface SpendingTrendPoint {
  date: string;
  amount: number;
  label: string;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface IncomeVsExpensePoint {
  month: string;
  year: number;
  monthLabel: string;
  income: number;
  expense: number;
  net: number;
}

export interface NetWorthPoint {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

export interface MonthlySummary {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  netFlow: number;
  transactionCount: number;
  topExpenseCategories: CategoryBreakdownItem[];
  topIncomeCategories: CategoryBreakdownItem[];
  previousMonthComparison: {
    incomeChange: number;
    expenseChange: number;
    netChange: number;
  } | null;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user's main currency from session
 */
async function getUserCurrency(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) return "IDR";
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mainCurrency: true },
  });
  
  return user?.mainCurrency || "IDR";
}

/**
 * Convert amount to user's main currency
 */
async function convertToUserCurrency(
  amount: number,
  fromCurrency: string,
  exchangeRate: number
): Promise<number> {
  if (fromCurrency === "IDR") return amount * exchangeRate;
  
  const userCurrency = await getUserCurrency();
  if (fromCurrency === userCurrency) return amount * exchangeRate;
  
  // Try to get exchange rate
  const rate = await getExchangeRate(fromCurrency, userCurrency);
  if (rate) return amount * rate;
  
  // Fallback to stored exchange rate
  return amount * exchangeRate;
}

/**
 * Format date for grouping
 */
function formatDateByGroup(date: Date, groupBy: "day" | "week" | "month"): string {
  const d = new Date(date);
  switch (groupBy) {
    case "day":
      return d.toISOString().split("T")[0];
    case "week":
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split("T")[0];
    case "month":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    default:
      return d.toISOString().split("T")[0];
  }
}

/**
 * Get label for grouped date
 */
function getLabelForGroup(date: Date, groupBy: "day" | "week" | "month"): string {
  const d = new Date(date);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  switch (groupBy) {
    case "day":
      return `${d.getDate()} ${monthNames[d.getMonth()]}`;
    case "week":
      return `Week of ${d.getDate()} ${monthNames[d.getMonth()]}`;
    case "month":
      return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    default:
      return `${d.getDate()} ${monthNames[d.getMonth()]}`;
  }
}

// ==================== SERVER ACTIONS ====================

/**
 * Get spending trends over time (daily/weekly/monthly)
 */
export async function getSpendingTrends(params: {
  startDate: Date;
  endDate: Date;
  groupBy: "day" | "week" | "month";
}): Promise<{ success: boolean; data?: SpendingTrendPoint[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { startDate, endDate, groupBy } = params;

    // Fetch all expense transactions in the date range
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: "EXPENSE",
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        amount: true,
        currency: true,
        exchangeRate: true,
      },
      orderBy: { date: "asc" },
    });

    // Group transactions by period
    const groupedData = new Map<string, { amount: number; date: Date }>();

    for (const t of transactions) {
      const normalizedAmount = await convertToUserCurrency(
        t.amount,
        t.currency,
        t.exchangeRate
      );
      const key = formatDateByGroup(t.date, groupBy);
      
      const existing = groupedData.get(key);
      if (existing) {
        existing.amount += normalizedAmount;
      } else {
        groupedData.set(key, { amount: normalizedAmount, date: t.date });
      }
    }

    // Convert to array and sort by date
    const result: SpendingTrendPoint[] = Array.from(groupedData.entries())
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        label: getLabelForGroup(data.date, groupBy),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data: result };
  } catch (error) {
    console.error("Get spending trends error:", error);
    return { success: false, error: "Failed to fetch spending trends" };
  }
}

/**
 * Get category breakdown for a period
 */
export async function getCategoryBreakdown(params: {
  startDate: Date;
  endDate: Date;
  type: "INCOME" | "EXPENSE";
}): Promise<{ success: boolean; data?: CategoryBreakdownItem[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { startDate, endDate, type } = params;

    // Fetch transactions with category info
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        category: true,
      },
    });

    // Group by category
    const categoryMap = new Map<string | null, {
      categoryId: string | null;
      categoryName: string;
      categoryColor: string | null;
      categoryIcon: string | null;
      amount: number;
      transactionCount: number;
    }>();

    let totalAmount = 0;

    for (const t of transactions) {
      const normalizedAmount = await convertToUserCurrency(
        t.amount,
        t.currency,
        t.exchangeRate
      );
      totalAmount += normalizedAmount;

      const key = t.categoryId;
      const existing = categoryMap.get(key);

      if (existing) {
        existing.amount += normalizedAmount;
        existing.transactionCount += 1;
      } else {
        categoryMap.set(key, {
          categoryId: t.categoryId,
          categoryName: t.category?.name || "Uncategorized",
          categoryColor: t.category?.color || null,
          categoryIcon: t.category?.icon || null,
          amount: normalizedAmount,
          transactionCount: 1,
        });
      }
    }

    // Convert to array and calculate percentages
    const result: CategoryBreakdownItem[] = Array.from(categoryMap.values())
      .map((item) => ({
        ...item,
        percentage: totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { success: true, data: result };
  } catch (error) {
    console.error("Get category breakdown error:", error);
    return { success: false, error: "Failed to fetch category breakdown" };
  }
}

/**
 * Get income vs expense comparison by month
 */
export async function getIncomeVsExpense(params: {
  months: number;
}): Promise<{ success: boolean; data?: IncomeVsExpensePoint[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { months } = params;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    // Fetch all income and expense transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: { in: ["INCOME", "EXPENSE"] },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        amount: true,
        currency: true,
        exchangeRate: true,
        type: true,
      },
    });

    // Group by month
    const monthMap = new Map<string, { income: number; expense: number; year: number; month: number }>();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (const t of transactions) {
      const normalizedAmount = await convertToUserCurrency(
        t.amount,
        t.currency,
        t.exchangeRate
      );
      
      const date = new Date(t.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      const existing = monthMap.get(key);
      if (existing) {
        if (t.type === "INCOME") {
          existing.income += normalizedAmount;
        } else {
          existing.expense += normalizedAmount;
        }
      } else {
        monthMap.set(key, {
          income: t.type === "INCOME" ? normalizedAmount : 0,
          expense: t.type === "EXPENSE" ? normalizedAmount : 0,
          year: date.getFullYear(),
          month: date.getMonth(),
        });
      }
    }

    // Convert to array and sort by date
    const result: IncomeVsExpensePoint[] = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        year: data.year,
        monthLabel: `${monthNames[data.month]} ${data.year}`,
        income: data.income,
        expense: data.expense,
        net: data.income - data.expense,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { success: true, data: result };
  } catch (error) {
    console.error("Get income vs expense error:", error);
    return { success: false, error: "Failed to fetch income vs expense data" };
  }
}

/**
 * Get net worth history
 */
export async function getNetWorthHistory(params: {
  months: number;
}): Promise<{ success: boolean; data?: NetWorthPoint[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { months } = params;

    // Get current account balances
    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        balance: true,
        currency: true,
      },
    });

    // Calculate current assets and liabilities
    let currentAssets = 0;
    let currentLiabilities = 0;

    for (const account of accounts) {
      const normalizedBalance = await convertToUserCurrency(
        Math.abs(account.balance),
        account.currency,
        1
      );
      
      const isAsset = ["BANK", "CASH", "INVESTMENT"].includes(account.type);
      const isLiability = ["LOAN", "CREDIT_CARD"].includes(account.type);
      
      if (isAsset) {
        currentAssets += normalizedBalance;
      } else if (isLiability) {
        currentLiabilities += normalizedBalance;
      }
    }

    // Get historical transactions to reconstruct past balances
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        amount: true,
        currency: true,
        exchangeRate: true,
        type: true,
        account: {
          select: { type: true },
        },
      },
      orderBy: { date: "desc" },
    });

    // Group by month and calculate net worth changes
    const monthMap = new Map<string, { assets: number; liabilities: number }>();
    
    // Initialize with current values
    let runningAssets = currentAssets;
    let runningLiabilities = currentLiabilities;

    // Create month keys for the period
    const monthKeys: string[] = [];
    const tempDate = new Date(endDate);
    while (tempDate >= startDate) {
      monthKeys.unshift(`${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, "0")}`);
      tempDate.setMonth(tempDate.getMonth() - 1);
    }

    // Process transactions in reverse chronological order
    for (const t of transactions) {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      
      const normalizedAmount = await convertToUserCurrency(
        t.amount,
        t.currency,
        t.exchangeRate
      );

      // Reverse the transaction effect
      if (t.type === "INCOME") {
        runningAssets -= normalizedAmount;
      } else if (t.type === "EXPENSE") {
        runningAssets += normalizedAmount;
      } else if (t.type === "TRANSFER") {
        // Transfers don't affect net worth
      } else if (t.type === "LIABILITY_PAYMENT") {
        runningAssets += normalizedAmount;
        runningLiabilities += normalizedAmount;
      }

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          assets: runningAssets,
          liabilities: runningLiabilities,
        });
      }
    }

    // Fill in missing months with interpolated values
    const result: NetWorthPoint[] = [];
    let lastAssets = currentAssets;
    let lastLiabilities = currentLiabilities;

    for (const monthKey of monthKeys) {
      const data = monthMap.get(monthKey);
      if (data) {
        lastAssets = data.assets;
        lastLiabilities = data.liabilities;
      }
      
      result.push({
        date: monthKey,
        netWorth: lastAssets - lastLiabilities,
        assets: lastAssets,
        liabilities: lastLiabilities,
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Get net worth history error:", error);
    return { success: false, error: "Failed to fetch net worth history" };
  }
}

/**
 * Get monthly summary
 */
export async function getMonthlySummary(params: {
  year: number;
  month: number;
}): Promise<{ success: boolean; data?: MonthlySummary; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { year, month } = params;

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get transaction summary
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
        type: { in: ["INCOME", "EXPENSE"] },
      },
      include: {
        category: true,
      },
    });

    // Calculate totals
    let totalIncome = 0;
    let totalExpense = 0;

    for (const t of transactions) {
      const normalizedAmount = await convertToUserCurrency(
        t.amount,
        t.currency,
        t.exchangeRate
      );

      if (t.type === "INCOME") {
        totalIncome += normalizedAmount;
      } else {
        totalExpense += normalizedAmount;
      }
    }

    // Get category breakdowns
    const [expenseCategories, incomeCategories] = await Promise.all([
      getCategoryBreakdown({ startDate, endDate, type: "EXPENSE" }),
      getCategoryBreakdown({ startDate, endDate, type: "INCOME" }),
    ]);

    // Get previous month data for comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStartDate = new Date(prevYear, prevMonth - 1, 1);
    const prevEndDate = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

    const prevTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: prevStartDate,
          lte: prevEndDate,
        },
        type: { in: ["INCOME", "EXPENSE"] },
      },
    });

    let prevIncome = 0;
    let prevExpense = 0;

    for (const t of prevTransactions) {
      const normalizedAmount = await convertToUserCurrency(
        t.amount,
        t.currency,
        t.exchangeRate
      );

      if (t.type === "INCOME") {
        prevIncome += normalizedAmount;
      } else {
        prevExpense += normalizedAmount;
      }
    }

    const previousMonthComparison = prevTransactions.length > 0 ? {
      incomeChange: totalIncome - prevIncome,
      expenseChange: totalExpense - prevExpense,
      netChange: (totalIncome - totalExpense) - (prevIncome - prevExpense),
    } : null;

    const result: MonthlySummary = {
      year,
      month,
      totalIncome,
      totalExpense,
      netFlow: totalIncome - totalExpense,
      transactionCount: transactions.length,
      topExpenseCategories: expenseCategories.data?.slice(0, 5) || [],
      topIncomeCategories: incomeCategories.data?.slice(0, 5) || [],
      previousMonthComparison,
    };

    return { success: true, data: result };
  } catch (error) {
    console.error("Get monthly summary error:", error);
    return { success: false, error: "Failed to fetch monthly summary" };
  }
}
