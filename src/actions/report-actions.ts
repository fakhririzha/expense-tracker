"use server";

import { z } from "zod";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import {
  flattenTransactionAllocationRows,
  type TransactionAllocationRow,
  type TransactionAllocationTransaction,
} from "@/lib/transaction-allocation-service";

const DEFAULT_REPORT_CURRENCY = "IDR";
const MAX_REPORT_RANGE_DAYS = 3660;
const MAX_REPORT_MONTHS = 120;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const reportDateRangeSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .superRefine(({ startDate, endDate }, ctx) => {
    if (startDate > endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date must be on or before end date",
        path: ["startDate"],
      });
    }

    const rangeDays =
      (endDate.getTime() - startDate.getTime()) / MILLISECONDS_PER_DAY;
    if (rangeDays > MAX_REPORT_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Date range cannot exceed ${MAX_REPORT_RANGE_DAYS} days`,
        path: ["endDate"],
      });
    }
  });

const spendingTrendsSchema = reportDateRangeSchema.extend({
  groupBy: z.enum(["day", "week", "month"]),
});

const categoryBreakdownSchema = reportDateRangeSchema.extend({
  type: z.enum(["INCOME", "EXPENSE"]),
});

const incomeVsExpenseSchema = z.object({
  months: z.number().int().min(1).max(MAX_REPORT_MONTHS),
});

const monthlySummarySchema = z.object({
  year: z.number().int().min(2000).max(9999),
  month: z.number().int().min(1).max(12),
});

interface ReportUser {
  id: string;
  mainCurrency: string;
}

interface ReportCurrencyConverter {
  targetCurrency: string;
  convert(amount: number, fromCurrency: string, fallbackRate: number): Promise<number>;
}

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

type ReportTransactionWithCategories = TransactionAllocationTransaction;

type ReportTransactionSummaryRow = {
  date: Date;
  amount: number;
  currency: string;
  exchangeRate: number;
  type: "INCOME" | "EXPENSE";
};

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function getCurrencyPairKey(fromCurrency: string, toCurrency: string): string {
  return `${normalizeCurrency(fromCurrency)}:${normalizeCurrency(toCurrency)}`;
}

function isFinitePositiveNumber(
  value: number | null | undefined
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function getAuthenticatedReportUser(): Promise<ReportUser | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      mainCurrency: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    mainCurrency: user.mainCurrency || DEFAULT_REPORT_CURRENCY,
  };
}

async function createReportCurrencyConverter(input: {
  targetCurrency: string;
  sourceCurrencies: string[];
}): Promise<ReportCurrencyConverter> {
  const targetCurrency = normalizeCurrency(input.targetCurrency);
  const sourceCurrencies = Array.from(
    new Set(
      input.sourceCurrencies
        .map(normalizeCurrency)
        .filter((currency) => currency && currency !== targetCurrency)
    )
  );

  const cachedRates =
    sourceCurrencies.length > 0
      ? await prisma.exchangeRate.findMany({
          where: {
            fromCurrency: { in: sourceCurrencies },
            toCurrency: targetCurrency,
          },
          select: {
            fromCurrency: true,
            toCurrency: true,
            rate: true,
          },
        })
      : [];

  const cachedRateMap = new Map(
    cachedRates.map((rate) => [
      getCurrencyPairKey(rate.fromCurrency, rate.toCurrency),
      rate.rate,
    ])
  );
  const rateLookups = new Map<string, Promise<number | null>>();

  async function resolveRate(fromCurrency: string): Promise<number | null> {
    if (fromCurrency === targetCurrency) {
      return 1;
    }

    const key = getCurrencyPairKey(fromCurrency, targetCurrency);
    const existingLookup = rateLookups.get(key);
    if (existingLookup) {
      return existingLookup;
    }

    const lookup = (async () => {
      const liveRate = await getExchangeRate(fromCurrency, targetCurrency);
      if (isFinitePositiveNumber(liveRate)) {
        return liveRate;
      }

      const cachedRate = cachedRateMap.get(key);
      if (isFinitePositiveNumber(cachedRate)) {
        return cachedRate;
      }

      return null;
    })();

    rateLookups.set(key, lookup);
    return lookup;
  }

  return {
    targetCurrency,
    async convert(amount: number, fromCurrency: string, fallbackRate: number) {
      if (amount === 0) {
        return 0;
      }

      const normalizedCurrency = normalizeCurrency(fromCurrency);
      if (normalizedCurrency === targetCurrency) {
        return amount;
      }

      const rate = await resolveRate(normalizedCurrency);
      if (isFinitePositiveNumber(rate)) {
        return amount * rate;
      }

      return isFinitePositiveNumber(fallbackRate)
        ? amount * fallbackRate
        : amount;
    },
  };
}

async function convertAmounts<T extends { amount: number; currency: string; exchangeRate: number }>(
  items: T[],
  converter: ReportCurrencyConverter
): Promise<number[]> {
  return Promise.all(
    items.map((item) =>
      converter.convert(item.amount, item.currency, item.exchangeRate)
    )
  );
}

async function fetchCategorizedTransactions(input: {
  userId: string;
  startDate: Date;
  endDate: Date;
  types: Array<"INCOME" | "EXPENSE">;
}): Promise<ReportTransactionWithCategories[]> {
  return prisma.transaction.findMany({
    where: {
      userId: input.userId,
      type: { in: input.types },
      date: {
        gte: input.startDate,
        lte: input.endDate,
      },
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      exchangeRate: true,
      type: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          icon: true,
        },
      },
      date: true,
      accountId: true,
      toAccountId: true,
      description: true,
      splits: {
        select: {
          id: true,
          amount: true,
          description: true,
          categoryId: true,
          sortOrder: true,
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: {
      date: "asc",
    },
  });
}

async function fetchSummaryTransactions(input: {
  userId: string;
  startDate: Date;
  endDate: Date;
}): Promise<ReportTransactionSummaryRow[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      type: { in: ["INCOME", "EXPENSE"] },
      date: {
        gte: input.startDate,
        lte: input.endDate,
      },
    },
    select: {
      date: true,
      amount: true,
      currency: true,
      exchangeRate: true,
      type: true,
    },
    orderBy: {
      date: "asc",
    },
  });

  return transactions.map((transaction) => ({
    ...transaction,
    type: transaction.type as "INCOME" | "EXPENSE",
  }));
}

function getAllocationRows(
  transactions: ReportTransactionWithCategories[],
  type: "INCOME" | "EXPENSE"
): Array<
  Pick<
    TransactionAllocationRow,
    "categoryId" | "category" | "amount" | "currency" | "exchangeRate"
  >
> {
  if (type === "EXPENSE") {
    return flattenTransactionAllocationRows(transactions);
  }

  return transactions.map((transaction) => ({
    categoryId: transaction.categoryId,
    category: transaction.category,
    amount: transaction.amount,
    currency: transaction.currency,
    exchangeRate: transaction.exchangeRate,
  }));
}

async function buildCategoryBreakdownFromTransactions(input: {
  transactions: ReportTransactionWithCategories[];
  type: "INCOME" | "EXPENSE";
  converter: ReportCurrencyConverter;
}): Promise<CategoryBreakdownItem[]> {
  const rows = getAllocationRows(input.transactions, input.type);
  const normalizedAmounts = await convertAmounts(rows, input.converter);
  const categoryMap = new Map<
    string | null,
    {
      categoryId: string | null;
      categoryName: string;
      categoryColor: string | null;
      categoryIcon: string | null;
      amount: number;
      transactionCount: number;
    }
  >();

  let totalAmount = 0;

  rows.forEach((row, index) => {
    const normalizedAmount = normalizedAmounts[index] ?? 0;
    totalAmount += normalizedAmount;

    const existing = categoryMap.get(row.categoryId);
    if (existing) {
      existing.amount += normalizedAmount;
      existing.transactionCount += 1;
      return;
    }

    categoryMap.set(row.categoryId, {
      categoryId: row.categoryId,
      categoryName: row.category?.name || "Uncategorized",
      categoryColor: row.category?.color || null,
      categoryIcon: row.category?.icon || null,
      amount: normalizedAmount,
      transactionCount: 1,
    });
  });

  return Array.from(categoryMap.values())
    .map((item) => ({
      ...item,
      percentage: totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

async function buildMonthlyTotals(input: {
  transactions: ReportTransactionSummaryRow[];
  converter: ReportCurrencyConverter;
}): Promise<{ totalIncome: number; totalExpense: number }> {
  const normalizedAmounts = await convertAmounts(
    input.transactions,
    input.converter
  );

  return input.transactions.reduce(
    (totals, transaction, index) => {
      const normalizedAmount = normalizedAmounts[index] ?? 0;
      if (transaction.type === "INCOME") {
        totals.totalIncome += normalizedAmount;
      } else {
        totals.totalExpense += normalizedAmount;
      }

      return totals;
    },
    { totalIncome: 0, totalExpense: 0 }
  );
}

function getMonthRange(year: number, month: number): {
  startDate: Date;
  endDate: Date;
} {
  return {
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

function collectSourceCurrencies(
  collections: Array<Array<{ currency: string }>>
): string[] {
  return collections.flatMap((items) => items.map((item) => item.currency));
}

function formatDateByGroup(
  date: Date,
  groupBy: "day" | "week" | "month"
): string {
  const d = new Date(date);
  switch (groupBy) {
    case "day":
      return d.toISOString().split("T")[0];
    case "week": {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split("T")[0];
    }
    case "month":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    default:
      return d.toISOString().split("T")[0];
  }
}

function getLabelForGroup(
  date: Date,
  groupBy: "day" | "week" | "month"
): string {
  const d = new Date(date);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

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

export async function getSpendingTrends(params: {
  startDate: Date;
  endDate: Date;
  groupBy: "day" | "week" | "month";
}): Promise<{ success: boolean; data?: SpendingTrendPoint[]; error?: string }> {
  try {
    const user = await getAuthenticatedReportUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = spendingTrendsSchema.safeParse(params);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const { startDate, endDate, groupBy } = validated.data;
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
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
      orderBy: {
        date: "asc",
      },
    });

    const converter = await createReportCurrencyConverter({
      targetCurrency: user.mainCurrency,
      sourceCurrencies: collectSourceCurrencies([transactions]),
    });
    const normalizedAmounts = await convertAmounts(transactions, converter);
    const groupedData = new Map<string, { amount: number; date: Date }>();

    transactions.forEach((transaction, index) => {
      const key = formatDateByGroup(transaction.date, groupBy);
      const existing = groupedData.get(key);
      const normalizedAmount = normalizedAmounts[index] ?? 0;

      if (existing) {
        existing.amount += normalizedAmount;
        return;
      }

      groupedData.set(key, {
        amount: normalizedAmount,
        date: transaction.date,
      });
    });

    const result: SpendingTrendPoint[] = Array.from(groupedData.entries())
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        label: getLabelForGroup(data.date, groupBy),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));

    return { success: true, data: result };
  } catch (error) {
    console.error("Get spending trends error:", error);
    return { success: false, error: "Failed to fetch spending trends" };
  }
}

export async function getCategoryBreakdown(params: {
  startDate: Date;
  endDate: Date;
  type: "INCOME" | "EXPENSE";
}): Promise<{ success: boolean; data?: CategoryBreakdownItem[]; error?: string }> {
  try {
    const user = await getAuthenticatedReportUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = categoryBreakdownSchema.safeParse(params);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const { startDate, endDate, type } = validated.data;
    const transactions = await fetchCategorizedTransactions({
      userId: user.id,
      startDate,
      endDate,
      types: [type],
    });
    const rows = getAllocationRows(transactions, type);
    const converter = await createReportCurrencyConverter({
      targetCurrency: user.mainCurrency,
      sourceCurrencies: collectSourceCurrencies([rows]),
    });
    const result = await buildCategoryBreakdownFromTransactions({
      transactions,
      type,
      converter,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Get category breakdown error:", error);
    return { success: false, error: "Failed to fetch category breakdown" };
  }
}

export async function getIncomeVsExpense(params: {
  months: number;
}): Promise<{ success: boolean; data?: IncomeVsExpensePoint[]; error?: string }> {
  try {
    const user = await getAuthenticatedReportUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = incomeVsExpenseSchema.safeParse(params);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const { months } = validated.data;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const transactions = await fetchSummaryTransactions({
      userId: user.id,
      startDate,
      endDate,
    });
    const converter = await createReportCurrencyConverter({
      targetCurrency: user.mainCurrency,
      sourceCurrencies: collectSourceCurrencies([transactions]),
    });
    const normalizedAmounts = await convertAmounts(transactions, converter);
    const monthMap = new Map<
      string,
      { income: number; expense: number; year: number; month: number }
    >();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    transactions.forEach((transaction, index) => {
      const date = new Date(transaction.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const normalizedAmount = normalizedAmounts[index] ?? 0;
      const existing = monthMap.get(key);

      if (existing) {
        if (transaction.type === "INCOME") {
          existing.income += normalizedAmount;
        } else {
          existing.expense += normalizedAmount;
        }
        return;
      }

      monthMap.set(key, {
        income: transaction.type === "INCOME" ? normalizedAmount : 0,
        expense: transaction.type === "EXPENSE" ? normalizedAmount : 0,
        year: date.getFullYear(),
        month: date.getMonth(),
      });
    });

    const result: IncomeVsExpensePoint[] = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        year: data.year,
        monthLabel: `${monthNames[data.month]} ${data.year}`,
        income: data.income,
        expense: data.expense,
        net: data.income - data.expense,
      }))
      .sort((left, right) => left.month.localeCompare(right.month));

    return { success: true, data: result };
  } catch (error) {
    console.error("Get income vs expense error:", error);
    return { success: false, error: "Failed to fetch income vs expense data" };
  }
}

export async function getMonthlySummary(params: {
  year: number;
  month: number;
}): Promise<{ success: boolean; data?: MonthlySummary; error?: string }> {
  try {
    const user = await getAuthenticatedReportUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = monthlySummarySchema.safeParse(params);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const { year, month } = validated.data;
    const { startDate, endDate } = getMonthRange(year, month);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const { startDate: prevStartDate, endDate: prevEndDate } = getMonthRange(
      prevYear,
      prevMonth
    );

    const [currentTransactions, previousTransactions] = await Promise.all([
      fetchCategorizedTransactions({
        userId: user.id,
        startDate,
        endDate,
        types: ["INCOME", "EXPENSE"],
      }),
      fetchSummaryTransactions({
        userId: user.id,
        startDate: prevStartDate,
        endDate: prevEndDate,
      }),
    ]);

    const currentSummaryTransactions: ReportTransactionSummaryRow[] =
      currentTransactions.map((transaction) => ({
        date: transaction.date,
        amount: transaction.amount,
        currency: transaction.currency,
        exchangeRate: transaction.exchangeRate,
        type: transaction.type as "INCOME" | "EXPENSE",
      }));
    const converter = await createReportCurrencyConverter({
      targetCurrency: user.mainCurrency,
      sourceCurrencies: collectSourceCurrencies([
        currentTransactions,
        previousTransactions,
      ]),
    });
    const [
      { totalIncome, totalExpense },
      { totalIncome: prevIncome, totalExpense: prevExpense },
      topExpenseCategories,
      topIncomeCategories,
    ] = await Promise.all([
      buildMonthlyTotals({
        transactions: currentSummaryTransactions,
        converter,
      }),
      buildMonthlyTotals({
        transactions: previousTransactions,
        converter,
      }),
      buildCategoryBreakdownFromTransactions({
        transactions: currentTransactions.filter(
          (transaction) => transaction.type === "EXPENSE"
        ),
        type: "EXPENSE",
        converter,
      }),
      buildCategoryBreakdownFromTransactions({
        transactions: currentTransactions.filter(
          (transaction) => transaction.type === "INCOME"
        ),
        type: "INCOME",
        converter,
      }),
    ]);

    const previousMonthComparison =
      previousTransactions.length > 0
        ? {
            incomeChange: totalIncome - prevIncome,
            expenseChange: totalExpense - prevExpense,
            netChange:
              totalIncome - totalExpense - (prevIncome - prevExpense),
          }
        : null;

    return {
      success: true,
      data: {
        year,
        month,
        totalIncome,
        totalExpense,
        netFlow: totalIncome - totalExpense,
        transactionCount: currentTransactions.length,
        topExpenseCategories: topExpenseCategories.slice(0, 5),
        topIncomeCategories: topIncomeCategories.slice(0, 5),
        previousMonthComparison,
      },
    };
  } catch (error) {
    console.error("Get monthly summary error:", error);
    return { success: false, error: "Failed to fetch monthly summary" };
  }
}
