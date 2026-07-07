"use server";

import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { decryptAccountName } from "@/lib/account-crypto";
import type {
  BudgetCategorySummary,
  BudgetScopeValue,
} from "@/lib/budget-utils";
import prisma from "@/lib/db";
import { flattenTransactionAllocationRows } from "@/lib/transaction-allocation-service";
import {
  BudgetPeriod,
  BudgetScope,
  TransactionType,
} from "@/generated/prisma/client/client";

const budgetSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    amount: z.number().positive("Amount must be positive"),
    period: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
    categoryIds: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.categoryIds.length > 0, {
    message: "Select at least one category",
    path: ["categoryIds"],
  });

export type BudgetInput = z.infer<typeof budgetSchema>;

export interface BudgetDetails {
  id: string;
  name: string;
  amount: number;
  period: BudgetPeriod;
  scope: BudgetScopeValue;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  categoryIds: string[];
  categories: BudgetCategorySummary[];
}

export interface BudgetWithProgress extends BudgetDetails {
  spent: number;
  remaining: number;
  percentage: number;
  daysRemaining: number;
  dailyAverage: number;
  projectedSpending: number;
}

interface BudgetAccountSummary {
  id: string;
  name: string;
  currency: string;
}

export interface BudgetTransactionListItem {
  id: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  type: TransactionType;
  description: string | null;
  date: Date;
  category: BudgetCategorySummary | null;
  account: BudgetAccountSummary;
  splitId?: string | null;
  isSplit?: boolean;
}

export interface BudgetVsActualItem {
  budgetId: string | null;
  budgetName: string | null;
  scope: BudgetScopeValue;
  categories: BudgetCategorySummary[];
  budgeted: number;
  actual: number;
  variance: number;
  percentageUsed: number;
  isOverBudget: boolean;
}

const BUDGET_SPENDING_TYPES: TransactionType[] = [
  TransactionType.EXPENSE,
  TransactionType.LIABILITY_PAYMENT,
];

const categorySummarySelect = {
  id: true,
  name: true,
  icon: true,
  color: true,
} as const;

const budgetSelect = {
  id: true,
  name: true,
  amount: true,
  period: true,
  scope: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  categories: {
    select: {
      category: {
        select: categorySummarySelect,
      },
    },
  },
} as const;

const expenseTransactionSelect = {
  id: true,
  accountId: true,
  amount: true,
  currency: true,
  exchangeRate: true,
  type: true,
  date: true,
  categoryId: true,
  toAccountId: true,
  description: true,
  category: {
    select: categorySummarySelect,
  },
  splits: {
    select: {
      id: true,
      amount: true,
      description: true,
      sortOrder: true,
      categoryId: true,
      category: {
        select: categorySummarySelect,
      },
    },
  },
} as const;

function getNormalizedAmount(transaction: {
  amount: number;
  exchangeRate: number;
}): number {
  return transaction.amount * transaction.exchangeRate;
}

function getUncategorizedCategorySummary(): BudgetCategorySummary {
  return {
    id: "uncategorized",
    name: "Uncategorized",
    icon: null,
    color: null,
  };
}

function toBudgetCategorySummary(
  category: {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
  } | null
): BudgetCategorySummary {
  if (!category) {
    return getUncategorizedCategorySummary();
  }

  return {
    id: category.id,
    name: category.name,
    icon: category.icon ?? null,
    color: category.color ?? null,
  };
}

function normalizeCategoryIds(categoryIds: string[]): string[] {
  return Array.from(
    new Set(
      categoryIds
        .map((categoryId) => categoryId.trim())
        .filter((categoryId) => categoryId.length > 0)
    )
  );
}

function mapBudgetRecord(budget: {
  id: string;
  name: string;
  amount: number;
  period: BudgetPeriod;
  scope: BudgetScope;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  categories: Array<{
    category: {
      id: string;
      name: string;
      icon: string | null;
      color: string | null;
    };
  }>;
}): BudgetDetails {
  const categories = [...budget.categories]
    .map((entry) => ({
      id: entry.category.id,
      name: entry.category.name,
      icon: entry.category.icon,
      color: entry.category.color,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    id: budget.id,
    name: budget.name,
    amount: budget.amount,
    period: budget.period,
    scope: budget.scope,
    startDate: budget.startDate,
    endDate: budget.endDate,
    isActive: budget.isActive,
    categoryIds: categories.map((category) => category.id),
    categories,
  };
}

function getBudgetDateRange(
  period: BudgetPeriod,
  baseDate = new Date()
): { start: Date; end: Date } {
  switch (period) {
    case BudgetPeriod.MONTHLY:
      return {
        start: startOfMonth(baseDate),
        end: endOfMonth(baseDate),
      };
    case BudgetPeriod.QUARTERLY:
      return {
        start: startOfQuarter(baseDate),
        end: endOfQuarter(baseDate),
      };
    case BudgetPeriod.YEARLY:
      return {
        start: startOfYear(baseDate),
        end: endOfYear(baseDate),
      };
    default:
      return {
        start: startOfMonth(baseDate),
        end: endOfMonth(baseDate),
      };
  }
}

function getBudgetAllocationSpend(
  categoryIds: Set<string>,
  allocationRows: Array<{
    categoryId: string | null;
    date: Date;
    normalizedAmount: number;
  }>,
  start: Date,
  end: Date
): number {
  return allocationRows.reduce((sum, row) => {
    if (row.date < start || row.date > end) {
      return sum;
    }

    if (!row.categoryId || !categoryIds.has(row.categoryId)) {
      return sum;
    }

    return sum + row.normalizedAmount;
  }, 0);
}

function getBudgetGlobalSpend(
  parentTransactions: Array<{
    amount: number;
    exchangeRate: number;
    date: Date;
    type: TransactionType;
  }>,
  start: Date,
  end: Date
): number {
  return parentTransactions.reduce((sum, transaction) => {
    if (transaction.date < start || transaction.date > end) {
      return sum;
    }

    if (!BUDGET_SPENDING_TYPES.includes(transaction.type)) {
      return sum;
    }

    return sum + getNormalizedAmount(transaction);
  }, 0);
}

function buildBudgetProgressRecord(
  budget: BudgetDetails,
  spent: number,
  now = new Date()
): BudgetWithProgress {
  const { start, end } = getBudgetDateRange(budget.period, now);
  const remaining = budget.amount - spent;
  const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const effectiveNow = now < start ? start : now > end ? end : now;
  const daysRemaining = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
  const daysPassed = Math.max(
    1,
    Math.ceil((effectiveNow.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  const dailyAverage = spent / daysPassed;
  const projectedSpending = dailyAverage * totalDays;

  return {
    ...budget,
    spent,
    remaining,
    percentage,
    daysRemaining,
    dailyAverage,
    projectedSpending,
  };
}

async function assertOwnedExpenseCategories(
  userId: string,
  categoryIds: string[]
): Promise<{ success: true; categoryIds: string[] } | { success: false; error: string }> {
  const normalizedCategoryIds = normalizeCategoryIds(categoryIds);

  if (normalizedCategoryIds.length === 0) {
    return { success: false, error: "Select at least one category" };
  }

  const categories = await prisma.category.findMany({
    where: {
      id: { in: normalizedCategoryIds },
      userId,
      type: TransactionType.EXPENSE,
    },
    select: { id: true },
  });

  if (categories.length !== normalizedCategoryIds.length) {
    return { success: false, error: "One or more categories were not found" };
  }

  return { success: true, categoryIds: normalizedCategoryIds };
}

function revalidateBudgetPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/budgets");
  revalidatePath("/dashboard/categories");
}

export async function getBudgetSpendingSummary(startDate: Date, endDate: Date) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: { in: BUDGET_SPENDING_TYPES },
        date: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
        exchangeRate: true,
      },
    });

    const totalSpent = transactions.reduce(
      (sum, transaction) => sum + getNormalizedAmount(transaction),
      0
    );

    return { success: true, data: { totalSpent } };
  } catch (error) {
    console.error("Get budget spending summary error:", error);
    return { success: false, error: "Failed to fetch budget spending summary" };
  }
}

export async function getBudgets() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] as BudgetDetails[] };
    }

    const budgets = await prisma.budget.findMany({
      where: { userId: session.user.id },
      select: budgetSelect,
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: budgets.map(mapBudgetRecord) };
  } catch (error) {
    console.error("Get budgets error:", error);
    return { success: false, error: "Failed to fetch budgets", data: [] as BudgetDetails[] };
  }
}

export async function getBudget(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const budget = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
      select: budgetSelect,
    });

    if (!budget) {
      return { success: false, error: "Budget not found" };
    }

    return { success: true, data: mapBudgetRecord(budget) };
  } catch (error) {
    console.error("Get budget error:", error);
    return { success: false, error: "Failed to fetch budget" };
  }
}

export async function createBudget(data: BudgetInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = budgetSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const categoryValidation = await assertOwnedExpenseCategories(
      session.user.id,
      validatedFields.data.categoryIds
    );
    if (!categoryValidation.success) {
      return { success: false, error: categoryValidation.error };
    }

    const budgetStart = getBudgetDateRange(
      validatedFields.data.period as BudgetPeriod
    ).start;

    const budget = await prisma.budget.create({
      data: {
        name: validatedFields.data.name,
        amount: validatedFields.data.amount,
        period: validatedFields.data.period,
        scope: BudgetScope.CATEGORIES,
        startDate: budgetStart,
        endDate: null,
        isActive: validatedFields.data.isActive,
        userId: session.user.id,
        categories: {
          create: categoryValidation.categoryIds.map((categoryId) => ({
            categoryId,
          })),
        },
      },
      select: budgetSelect,
    });

    revalidateBudgetPaths();

    return { success: true, data: mapBudgetRecord(budget) };
  } catch (error) {
    console.error("Create budget error:", error);
    return { success: false, error: "Failed to create budget" };
  }
}

export async function updateBudget(id: string, data: Partial<BudgetInput>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = budgetSchema.partial().safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const existingBudget = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
      select: budgetSelect,
    });

    if (!existingBudget) {
      return { success: false, error: "Budget not found" };
    }

    let normalizedCategoryIds: string[] | undefined;
    if (validatedFields.data.categoryIds !== undefined) {
      normalizedCategoryIds = normalizeCategoryIds(validatedFields.data.categoryIds);

      if (normalizedCategoryIds.length > 0) {
        const categoryValidation = await assertOwnedExpenseCategories(
          session.user.id,
          normalizedCategoryIds
        );
        if (!categoryValidation.success) {
          return { success: false, error: categoryValidation.error };
        }
        normalizedCategoryIds = categoryValidation.categoryIds;
      } else if (existingBudget.scope !== BudgetScope.LEGACY_GLOBAL) {
        return { success: false, error: "Select at least one category" };
      }
    }

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        name: validatedFields.data.name,
        amount: validatedFields.data.amount,
        period: validatedFields.data.period,
        isActive: validatedFields.data.isActive,
        ...(normalizedCategoryIds !== undefined
          ? {
              scope:
                normalizedCategoryIds.length > 0
                  ? BudgetScope.CATEGORIES
                  : BudgetScope.LEGACY_GLOBAL,
              categories: {
                deleteMany: {},
                ...(normalizedCategoryIds.length > 0
                  ? {
                      create: normalizedCategoryIds.map((categoryId) => ({
                        categoryId,
                      })),
                    }
                  : {}),
              },
            }
          : {}),
      },
      select: budgetSelect,
    });

    revalidateBudgetPaths();

    return { success: true, data: mapBudgetRecord(budget) };
  } catch (error) {
    console.error("Update budget error:", error);
    return { success: false, error: "Failed to update budget" };
  }
}

export async function deleteBudget(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const budget = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });

    if (!budget) {
      return { success: false, error: "Budget not found" };
    }

    await prisma.budget.delete({ where: { id } });

    revalidateBudgetPaths();

    return { success: true };
  } catch (error) {
    console.error("Delete budget error:", error);
    return { success: false, error: "Failed to delete budget" };
  }
}

export async function getBudgetProgress(
  id: string
): Promise<{ success: boolean; error?: string; data?: BudgetWithProgress }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const budgetRecord = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
      select: budgetSelect,
    });

    if (!budgetRecord) {
      return { success: false, error: "Budget not found" };
    }

    const budget = mapBudgetRecord(budgetRecord);
    const now = new Date();
    const { start, end } = getBudgetDateRange(budget.period, now);

    const parentTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: { gte: start, lte: end },
        type:
          budget.scope === BudgetScope.CATEGORIES
            ? TransactionType.EXPENSE
            : { in: BUDGET_SPENDING_TYPES },
      },
      select: expenseTransactionSelect,
    });

    const spent =
      budget.scope === BudgetScope.CATEGORIES
        ? getBudgetAllocationSpend(
            new Set(budget.categoryIds),
            flattenTransactionAllocationRows(parentTransactions),
            start,
            end
          )
        : getBudgetGlobalSpend(parentTransactions, start, end);

    return {
      success: true,
      data: buildBudgetProgressRecord(budget, spent, now),
    };
  } catch (error) {
    console.error("Get budget progress error:", error);
    return { success: false, error: "Failed to fetch budget progress" };
  }
}

export async function getBudgetsSummary() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] as BudgetWithProgress[] };
    }

    const budgetRecords = await prisma.budget.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: budgetSelect,
      orderBy: { createdAt: "desc" },
    });

    if (budgetRecords.length === 0) {
      return { success: true, data: [] as BudgetWithProgress[] };
    }

    const budgets = budgetRecords.map(mapBudgetRecord);
    const now = new Date();
    const dateRanges = budgets.map((budget) =>
      getBudgetDateRange(budget.period, now)
    );
    const minDate = new Date(
      Math.min(...dateRanges.map((range) => range.start.getTime()))
    );
    const maxDate = new Date(
      Math.max(...dateRanges.map((range) => range.end.getTime()))
    );

    const parentTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: { in: BUDGET_SPENDING_TYPES },
        date: { gte: minDate, lte: maxDate },
      },
      select: expenseTransactionSelect,
    });

    const allocationRows = flattenTransactionAllocationRows(
      parentTransactions.filter((transaction) => transaction.type === TransactionType.EXPENSE)
    );
    const budgetsWithProgress = budgets.map((budget) => {
      const { start, end } = getBudgetDateRange(budget.period, now);
      const spent =
        budget.scope === BudgetScope.CATEGORIES
          ? getBudgetAllocationSpend(
              new Set(budget.categoryIds),
              allocationRows,
              start,
              end
            )
          : getBudgetGlobalSpend(parentTransactions, start, end);

      return buildBudgetProgressRecord(budget, spent, now);
    });

    return { success: true, data: budgetsWithProgress };
  } catch (error) {
    console.error("Get budgets summary error:", error);
    return { success: false, error: "Failed to fetch budgets summary", data: [] as BudgetWithProgress[] };
  }
}

export async function getBudgetVsActual() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] as BudgetVsActualItem[] };
    }

    const budgetRecords = await prisma.budget.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: budgetSelect,
      orderBy: { createdAt: "desc" },
    });

    const budgets = budgetRecords.map(mapBudgetRecord);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const budgetRanges = budgets.map((budget) =>
      getBudgetDateRange(budget.period, now)
    );
    const minDate = budgetRanges.length
      ? new Date(
          Math.min(
            monthStart.getTime(),
            ...budgetRanges.map((range) => range.start.getTime())
          )
        )
      : monthStart;
    const maxDate = budgetRanges.length
      ? new Date(
          Math.max(
            monthEnd.getTime(),
            ...budgetRanges.map((range) => range.end.getTime())
          )
        )
      : monthEnd;

    const budgetSpending = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: { in: BUDGET_SPENDING_TYPES },
        date: { gte: minDate, lte: maxDate },
      },
      select: expenseTransactionSelect,
    });

    const allocationRows = flattenTransactionAllocationRows(
      budgetSpending.filter((transaction) => transaction.type === TransactionType.EXPENSE)
    );

    const expensesByCategory = new Map<
      string,
      { category: BudgetCategorySummary; amount: number }
    >();
    for (const allocation of allocationRows) {
      if (allocation.date < monthStart || allocation.date > monthEnd) {
        continue;
      }

      const categoryId = allocation.categoryId || "uncategorized";
      const existing = expensesByCategory.get(categoryId);
      if (existing) {
        existing.amount += allocation.normalizedAmount;
      } else {
        expensesByCategory.set(categoryId, {
          category: toBudgetCategorySummary(allocation.category),
          amount: allocation.normalizedAmount,
        });
      }
    }

    const coveredCategoryIds = new Set<string>();
    const comparison: BudgetVsActualItem[] = budgets.map((budget) => {
      const { start, end } = getBudgetDateRange(budget.period, now);

      if (budget.scope === BudgetScope.CATEGORIES) {
        budget.categoryIds.forEach((categoryId) => coveredCategoryIds.add(categoryId));
      }

      const actual =
        budget.scope === BudgetScope.CATEGORIES
          ? getBudgetAllocationSpend(
              new Set(budget.categoryIds),
              allocationRows,
              start,
              end
            )
          : getBudgetGlobalSpend(budgetSpending, start, end);
      const variance = budget.amount - actual;

      return {
        budgetId: budget.id,
        budgetName: budget.name,
        scope: budget.scope,
        categories: budget.categories,
        budgeted: budget.amount,
        actual,
        variance,
        percentageUsed: budget.amount > 0 ? (actual / budget.amount) * 100 : 0,
        isOverBudget: actual > budget.amount,
      };
    });

    for (const [categoryId, data] of expensesByCategory) {
      if (categoryId === "uncategorized") {
        comparison.push({
          budgetId: null,
          budgetName: null,
          scope: BudgetScope.CATEGORIES,
          categories: [data.category],
          budgeted: 0,
          actual: data.amount,
          variance: -data.amount,
          percentageUsed: 100,
          isOverBudget: true,
        });
        continue;
      }

      if (coveredCategoryIds.has(categoryId)) {
        continue;
      }

      comparison.push({
        budgetId: null,
        budgetName: null,
        scope: BudgetScope.CATEGORIES,
        categories: [data.category],
        budgeted: 0,
        actual: data.amount,
        variance: -data.amount,
        percentageUsed: 100,
        isOverBudget: true,
      });
    }

    return { success: true, data: comparison };
  } catch (error) {
    console.error("Get budget vs actual error:", error);
    return { success: false, error: "Failed to fetch budget vs actual comparison", data: [] as BudgetVsActualItem[] };
  }
}

export async function getBudgetTransactions(
  budgetId: string
): Promise<{ success: boolean; data: BudgetTransactionListItem[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const budgetRecord = await prisma.budget.findFirst({
      where: { id: budgetId, userId: session.user.id },
      select: budgetSelect,
    });

    if (!budgetRecord) {
      return { success: false, error: "Budget not found", data: [] };
    }

    const budget = mapBudgetRecord(budgetRecord);
    const { start, end } = getBudgetDateRange(budget.period);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        date: { gte: start, lte: end },
        type:
          budget.scope === BudgetScope.CATEGORIES
            ? TransactionType.EXPENSE
            : { in: BUDGET_SPENDING_TYPES },
      },
      select: {
        ...expenseTransactionSelect,
        account: {
          select: {
            id: true,
            nameEncrypted: true,
            currency: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const decryptedTransactions = await Promise.all(
      transactions.map(async (transaction) => ({
        ...transaction,
        account: {
          id: transaction.account.id,
          currency: transaction.account.currency,
          name: await decryptAccountName(
            session.user.id,
            transaction.account.nameEncrypted
          ),
        },
      }))
    );

    if (budget.scope === BudgetScope.CATEGORIES) {
      const selectedCategoryIds = new Set(budget.categoryIds);
      const parentById = new Map(
        decryptedTransactions.map((transaction) => [transaction.id, transaction])
      );

      const data = flattenTransactionAllocationRows(decryptedTransactions).flatMap(
        (transaction): BudgetTransactionListItem[] => {
          if (
            transaction.categoryId === null ||
            !selectedCategoryIds.has(transaction.categoryId)
          ) {
            return [];
          }

          const parent = parentById.get(transaction.transactionId);
          if (!parent) {
            return [];
          }

          return [
            {
              id: transaction.splitId
                ? `${transaction.transactionId}:${transaction.splitId}`
                : transaction.transactionId,
              splitId: transaction.splitId,
              amount: transaction.amount,
              currency: transaction.currency,
              exchangeRate: transaction.exchangeRate,
              type: transaction.type as TransactionType,
              description: transaction.description,
              date: transaction.date,
              category: toBudgetCategorySummary(transaction.category),
              account: parent.account,
              isSplit: transaction.isSplit,
            },
          ];
        }
      );

      return { success: true, data };
    }

    return {
      success: true,
      data: decryptedTransactions.map((transaction) => ({
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        exchangeRate: transaction.exchangeRate,
        type: transaction.type,
        description: transaction.description,
        date: transaction.date,
        category: transaction.category
          ? toBudgetCategorySummary(transaction.category)
          : null,
        account: transaction.account,
        isSplit: transaction.splits.length > 0,
      })),
    };
  } catch (error) {
    console.error("Get budget transactions error:", error);
    return { success: false, error: "Failed to fetch budget transactions", data: [] };
  }
}
