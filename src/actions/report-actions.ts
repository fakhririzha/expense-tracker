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
 * Retrieves the current user's main currency from the active session or user record.
 *
 * @returns The user's main currency code (e.g., "USD"); returns "IDR" if there is no authenticated user or no currency is set.
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
 * Convert an amount from a source currency into the current user's main currency.
 *
 * Attempts to use a direct exchange rate lookup when the source currency differs from the user's currency; falls back to the provided `exchangeRate` when no direct rate is available.
 *
 * @param amount - The numeric amount in `fromCurrency`
 * @param fromCurrency - The ISO currency code of the input amount
 * @param exchangeRate - Fallback or stored exchange rate to use if a direct rate cannot be obtained
 * @returns The amount converted into the user's main currency
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
 * Produce a string key representing the given date according to the specified grouping.
 *
 * @param date - The date to format.
 * @param groupBy - The granularity to use: "day" yields `YYYY-MM-DD`, "week" yields the start-of-week date `YYYY-MM-DD` (week starts on Sunday), and "month" yields `YYYY-MM`.
 * @returns The formatted date key for the specified group.
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
 * Produce a human-friendly label for a date according to the requested grouping.
 *
 * @param date - The date to format into a label.
 * @param groupBy - Grouping granularity: `"day"` -> `D Mon` (e.g., `12 Feb`), `"week"` -> `Week of D Mon` (e.g., `Week of 12 Feb`), `"month"` -> `Mon YYYY` (e.g., `Feb 2026`).
 * @returns The formatted label string for the given date and grouping.
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
 * Aggregate expense transactions into a time series grouped by day, week, or month.
 *
 * @param startDate - Inclusive start date for the range to analyze
 * @param endDate - Inclusive end date for the range to analyze
 * @param groupBy - Grouping granularity: `"day"`, `"week"`, or `"month"`
 * @returns An array of spending trend points where each point contains a period key, the total amount converted to the user's main currency, and a human-friendly label
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
 * Aggregate transactions within a date range by category and compute totals and percentages.
 *
 * @param startDate - Inclusive start of the date range to include transactions from
 * @param endDate - Inclusive end of the date range to include transactions up to
 * @param type - Transaction type to include (`"INCOME"` or `"EXPENSE"`)
 * @returns An object with a `success` flag; when `success` is `true`, `data` is an array of CategoryBreakdownItem objects (one per category, including amount, transactionCount, and percentage) sorted by amount descending
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
 * Compute monthly totals of income and expense over a recent span of months.
 *
 * Aggregates all INCOME and EXPENSE transactions in the window and returns a sorted
 * month-by-month breakdown including income, expense, and net values.
 *
 * @param months - Number of months to include, counting the current month (for example, `1` includes only the current month).
 * @returns An array of `IncomeVsExpensePoint` objects sorted by month; each entry contains `month` (YYYY-MM), `year`, `monthLabel`, `income`, `expense`, and `net`.
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
 * Reconstructs monthly net worth history for a past span of months.
 *
 * Builds a month-by-month series by combining current account balances with historical transactions (converted to the user's main currency) to produce assets, liabilities, and net worth for each month in the requested window.
 *
 * @param months - Number of months to include, counting backward from the current month (defines the start of the window)
 * @returns An array of `NetWorthPoint` objects (one per month) containing `date` (YYYY-MM), `assets`, `liabilities`, and `netWorth`
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

    // Validate months parameter to prevent DoS attacks
    const MAX_MONTHS = 120; // 10 years maximum
    if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
      return { success: false, error: `Months must be between 1 and ${MAX_MONTHS}` };
    }

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

    // Build result with end-of-month balances
    // The monthMap[M] stores the balance at the START of month M (after reversing all transactions in M)
    // This equals the balance at the END of month M-1
    // So for month M's end-of-month balance, we look at monthMap[M+1] (start of next month = end of current month)
    // For the last month, we use current balances
    const result: NetWorthPoint[] = [];

    // Pre-calculate next available data points in O(N) using a backward pass
    // nextAvailableData[i] stores the next month's data for monthKeys[i]
    const nextAvailableData = new Array<{ assets: number; liabilities: number } | null>(monthKeys.length).fill(null);
    let lastSeenData: { assets: number; liabilities: number } | null = null;

    for (let i = monthKeys.length - 1; i >= 0; i--) {
      const monthData = monthMap.get(monthKeys[i]);
      if (monthData) {
        lastSeenData = monthData;
      }
      nextAvailableData[i] = lastSeenData;
    }

    for (let i = 0; i < monthKeys.length; i++) {
      const monthKey = monthKeys[i];
      
      // For month M's end-of-month balance:
      // - Use the next month with data (monthMap[M+1], M+2, etc.)
      // - If no future month has data, use current balances (end of last month)
      
      const nextData = nextAvailableData[i];
      const assets: number = nextData?.assets ?? currentAssets;
      const liabilities: number = nextData?.liabilities ?? currentLiabilities;
      
      result.push({
        date: monthKey,
        netWorth: assets - liabilities,
        assets,
        liabilities,
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Get net worth history error:", error);
    return { success: false, error: "Failed to fetch net worth history" };
  }
}

/**
 * Compute a currency-normalized financial summary for a specific month.
 *
 * Produces totals for income and expenses, net flow, transaction count, top income and expense categories (up to 5 each), and an optional comparison to the previous month.
 *
 * @param year - The four-digit year for the summary (e.g., 2026)
 * @param month - The month number (1-12) for the summary
 * @returns An object containing the `MonthlySummary` for the requested month when successful; otherwise an error message is returned in the wrapper object.
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