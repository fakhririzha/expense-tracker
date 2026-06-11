"use server";

import { auth } from "@/auth";
import { decryptAccountName } from "@/lib/account-crypto";
import prisma from "@/lib/db";
import { TransactionType } from "@/generated/prisma/client/client";
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Schema for budget validation
const budgetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive("Amount must be positive"),
  period: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  startDate: z.date(),
  endDate: z.date().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

// Type for budget with progress
export interface BudgetWithProgress {
  id: string;
  name: string;
  amount: number;
  period: string;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  spent: number;
  remaining: number;
  percentage: number;
  daysRemaining: number;
  dailyAverage: number;
  projectedSpending: number;
}

interface BudgetCategorySummary {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
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
}

const BUDGET_SPENDING_TYPES: TransactionType[] = [
  TransactionType.EXPENSE,
  TransactionType.LIABILITY_PAYMENT,
];

function getNormalizedAmount(transaction: {
  amount: number;
  exchangeRate: number;
}): number {
  return transaction.amount * transaction.exchangeRate;
}

/**
 * Summarize spending for budget-focused surfaces.
 *
 * Includes regular expenses and liability payments, normalized into the user's
 * main currency using the transaction's stored exchange rate.
 */
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

/**
 * Fetches all budgets for the authenticated user, including each budget's category summary (id, name, icon, color).
 *
 * @returns An object where `success` is `true` and `data` is an array of budgets with category metadata on success; `success` is `false`, `error` contains a message, and `data` is an empty array on failure or when the user is unauthorized.
 */
export async function getBudgets() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const budgets = await prisma.budget.findMany({
      where: { userId: session.user.id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: budgets };
  } catch (error) {
    console.error("Get budgets error:", error);
    return { success: false, error: "Failed to fetch budgets", data: [] };
  }
}

/**
 * Fetches a budget by ID for the authenticated user, including its category metadata.
 *
 * @returns `{ success: true, data: Budget }` when the budget is found; `{ success: false, error: string }` when the user is unauthorized, the budget is not found, or an error occurs. The returned `data` includes the budget fields and a `category` object with `id`, `name`, `icon`, and `color`.
 */
export async function getBudget(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const budget = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    if (!budget) {
      return { success: false, error: "Budget not found" };
    }

    return { success: true, data: budget };
  } catch (error) {
    console.error("Get budget error:", error);
    return { success: false, error: "Failed to fetch budget" };
  }
}

/**
 * Create a new budget for the authenticated user.
 *
 * Validates the provided budget payload, enforces category ownership to prevent IDOR,
 * persists the budget linked to the current user, and revalidates dashboard cache paths.
 *
 * @param data - The budget input to create (validated against `budgetSchema`)
 * @returns `success: true` and the created budget in `data` on success; `success: false` and an `error` message otherwise
 */
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

    // Validate category belongs to the current user (IDOR prevention)
    const { categoryId, ...restData } = validatedFields.data;
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId: session.user.id,
        },
      });
      if (!category) {
        return { success: false, error: "Category not found" };
      }
    }

    const budget = await prisma.budget.create({
      data: {
        ...restData,
        categoryId: categoryId?.trim() || null,
        userId: session.user.id,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budgets");

    return { success: true, data: budget };
  } catch (error) {
    console.error("Create budget error:", error);
    return { success: false, error: "Failed to create budget" };
  }
}

/**
 * Update an existing budget for the authenticated user.
 *
 * Validates the provided partial budget fields and verifies category ownership when a `categoryId` is supplied.
 *
 * @param id - The ID of the budget to update
 * @param data - Partial fields of the budget to apply (validated against the budget schema)
 * @returns An object with `success: true` and the updated budget in `data` on success; otherwise `success: false` and an `error` message.
 */
export async function updateBudget(id: string, data: Partial<BudgetInput>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate the partial payload
    const validatedFields = budgetSchema.partial().safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const existingBudget = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingBudget) {
      return { success: false, error: "Budget not found" };
    }

    // Validate category belongs to the current user (IDOR prevention)
    if (data.categoryId !== undefined) {
      const sanitizedCategoryId = data.categoryId?.trim() || null;
      if (sanitizedCategoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: sanitizedCategoryId,
            userId: session.user.id,
          },
        });
        if (!category) {
          return { success: false, error: "Category not found" };
        }
      }
    }

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        ...data,
        categoryId: data.categoryId !== undefined ? (data.categoryId?.trim() || null) : undefined,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budgets");

    return { success: true, data: budget };
  } catch (error) {
    console.error("Update budget error:", error);
    return { success: false, error: "Failed to update budget" };
  }
}

/**
 * Delete a budget owned by the current user and revalidate dashboard cache paths.
 *
 * @param id - The ID of the budget to delete
 * @returns `{ success: true }` on success; `{ success: false, error: string }` on failure (possible errors include `"Unauthorized"`, `"Budget not found"`, or `"Failed to delete budget"`)
 */
export async function deleteBudget(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const budget = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!budget) {
      return { success: false, error: "Budget not found" };
    }

    await prisma.budget.delete({ where: { id } });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budgets");

    return { success: true };
  } catch (error) {
    console.error("Delete budget error:", error);
    return { success: false, error: "Failed to delete budget" };
  }
}

/**
 * Compute the inclusive start and end dates that cover a budget's configured period.
 *
 * @param budget - Object containing `period` (e.g. "MONTHLY", "QUARTERLY", "YEARLY"), `startDate` (base date for the period), and optional `endDate` (to extend the period).
 * @returns An object with `start` and `end` Dates that delimit the budget period.
 */
function getBudgetDateRange(budget: { period: string; startDate: Date; endDate?: Date | null }): { start: Date; end: Date } {
  // Use budget's startDate as the base for period calculations
  const baseDate = budget.startDate;
  
  switch (budget.period) {
    case "MONTHLY":
      return {
        start: startOfMonth(baseDate),
        end: budget.endDate ? endOfMonth(budget.endDate) : endOfMonth(baseDate),
      };
    case "QUARTERLY":
      return {
        start: startOfQuarter(baseDate),
        end: budget.endDate ? endOfQuarter(budget.endDate) : endOfQuarter(baseDate),
      };
    case "YEARLY":
      return {
        start: startOfYear(baseDate),
        end: budget.endDate ? endOfYear(budget.endDate) : endOfYear(baseDate),
      };
    default:
      return {
        start: startOfMonth(baseDate),
        end: budget.endDate ? endOfMonth(budget.endDate) : endOfMonth(baseDate),
      };
  }
}

/**
 * Compute spending progress and projections for a specific budget.
 *
 * @param id - The budget's ID
 * @returns An object with a `success` flag; on success `data` contains the budget enriched with progress metrics (`spent`, `remaining`, `percentage`, `daysRemaining`, `dailyAverage`, `projectedSpending`), on failure `error` contains a human-readable message
 */
export async function getBudgetProgress(id: string): Promise<{ success: boolean; error?: string; data?: BudgetWithProgress }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const budget = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    if (!budget) {
      return { success: false, error: "Budget not found" };
    }

    const { start, end } = getBudgetDateRange(budget);

    // Get transactions for the budget period
    const whereClause = {
      userId: session.user.id,
      date: { gte: start, lte: end },
      ...(budget.categoryId
        ? {
            type: TransactionType.EXPENSE,
            categoryId: budget.categoryId,
          }
        : {
            type: { in: BUDGET_SPENDING_TYPES },
          }),
    };

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      select: {
        amount: true,
        exchangeRate: true,
      },
    });

    // Calculate spent amount
    const spent = transactions.reduce((sum, t) => sum + getNormalizedAmount(t), 0);
    const remaining = budget.amount - spent;
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    // Calculate days remaining in period
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate daily average
    const daysPassed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyAverage = spent / daysPassed;

    // Project spending for the rest of the period
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const projectedSpending = dailyAverage * totalDays;

    const budgetWithProgress: BudgetWithProgress = {
      id: budget.id,
      name: budget.name,
      amount: budget.amount,
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      isActive: budget.isActive,
      categoryId: budget.categoryId,
      category: budget.category,
      spent,
      remaining,
      // percentage: Math.min(percentage, 100),
      percentage,
      daysRemaining,
      dailyAverage,
      projectedSpending,
    };

    return { success: true, data: budgetWithProgress };
  } catch (error) {
    console.error("Get budget progress error:", error);
    return { success: false, error: "Failed to fetch budget progress" };
  }
}

/**
 * Fetches all active budgets for the current user and computes per-budget progress metrics for each budget's current period.
 *
 * @returns An object containing a `success` boolean, `data` — an array of `BudgetWithProgress` objects (one per active budget, empty on failure), and an `error` string when the operation fails.
 */
export async function getBudgetsSummary() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    // 1. Fetch all active budgets
    const budgets = await prisma.budget.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (budgets.length === 0) {
      return { success: true, data: [] };
    }

    // 2. Determine date ranges needed for each period type
    const now = new Date();
    const dateRanges = {
      MONTHLY: { start: startOfMonth(now), end: endOfMonth(now) },
      QUARTERLY: { start: startOfQuarter(now), end: endOfQuarter(now) },
      YEARLY: { start: startOfYear(now), end: endOfYear(now) },
    };

    // 3. Find the overall date range to fetch all relevant transactions
    const minDate = new Date(Math.min(...Object.values(dateRanges).map(r => r.start.getTime())));
    const maxDate = new Date(Math.max(...Object.values(dateRanges).map(r => r.end.getTime())));

    // 4. Collect all category IDs (including null for budgets without category)
    const categoryIds = budgets
      .map(b => b.categoryId)
      .filter((id): id is string => id !== null);

    // Check if any budget has no category (all-category budget)
    const hasAllCategoryBudget = budgets.some(b => b.categoryId === null);

    // 5. Fetch all relevant transactions in a single query
    const allTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: hasAllCategoryBudget
          ? { in: BUDGET_SPENDING_TYPES }
          : TransactionType.EXPENSE,
        date: { gte: minDate, lte: maxDate },
        // Only filter by categoryId if there are category-specific budgets AND no all-category budget
        ...(categoryIds.length > 0 && !hasAllCategoryBudget && { categoryId: { in: categoryIds } }),
      },
      select: {
        amount: true,
        date: true,
        categoryId: true,
        exchangeRate: true,
      },
    });

    // 6. Group transactions by category for efficient lookup
    const transactionsByCategory = new Map<string | null, typeof allTransactions>();
    for (const transaction of allTransactions) {
      const key = transaction.categoryId;
      if (!transactionsByCategory.has(key)) {
        transactionsByCategory.set(key, []);
      }
      transactionsByCategory.get(key)!.push(transaction);
    };

    // 7. Calculate progress for each budget using in-memory data
    const budgetsWithProgress: BudgetWithProgress[] = budgets.map(budget => {
      const { start, end } = dateRanges[budget.period as keyof typeof dateRanges] || dateRanges.MONTHLY;
      
      // Get transactions for this budget's category (or all transactions if no category)
      const relevantTransactions = budget.categoryId
        ? (transactionsByCategory.get(budget.categoryId) || [])
        : allTransactions.filter(t => t.date >= start && t.date <= end);
      
      // Filter by date range for category-specific budgets
      const budgetTransactions = budget.categoryId
        ? relevantTransactions.filter(t => t.date >= start && t.date <= end)
        : relevantTransactions;

      // Calculate spent amount
      const spent = budgetTransactions.reduce((sum, t) => sum + getNormalizedAmount(t), 0);
      const remaining = budget.amount - spent;
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      // Calculate days remaining in period
      const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // Calculate daily average
      const daysPassed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const dailyAverage = spent / daysPassed;

      // Project spending for the rest of the period
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const projectedSpending = dailyAverage * totalDays;

      return {
        id: budget.id,
        name: budget.name,
        amount: budget.amount,
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate,
        isActive: budget.isActive,
        categoryId: budget.categoryId,
        category: budget.category,
        spent,
        remaining,
        percentage,
        daysRemaining,
        dailyAverage,
        projectedSpending,
      };
    });

    return { success: true, data: budgetsWithProgress };
  } catch (error) {
    console.error("Get budgets summary error:", error);
    return { success: false, error: "Failed to fetch budgets summary", data: [] };
  }
}

/**
 * Compare active budgets to actual budget spending for the current month.
 *
 * Returns an object describing success and a data array where each entry represents a category's budget vs actual comparison.
 *
 * @returns An object with a `success` flag and `data` array. Each data entry contains:
 * - `budgetId`: the budget's id or `null` when no budget exists for the category
 * - `budgetName`: the budget's name or `null` when no budget exists
 * - `category`: category metadata (`id`, `name`, `icon`, `color`)
 * - `budgeted`: the budgeted amount for the category
 * - `actual`: the total expenses for the category in the current month
 * - `variance`: `budgeted - actual`
 * - `percentageUsed`: percent of the budget consumed (0–100+, `100` used for uncategorized-only entries)
 * - `isOverBudget`: `true` when `actual` is greater than `budgeted`, `false` otherwise
 */
export async function getBudgetVsActual() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Get all active budgets with categories
    const budgets = await prisma.budget.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    // Get all budget spending for the current month. Category budgets include
    // regular expenses only; all-category budgets include liability payments too.
    const budgetSpending = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: { in: BUDGET_SPENDING_TYPES },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: {
        amount: true,
        exchangeRate: true,
        type: true,
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
    });

    // Group regular expenses by category for category-specific budgets.
    const expensesByCategory = new Map<string, { category: { id: string; name: string; icon: string | null; color: string | null }; amount: number }>();
    let allCategoryActual = 0;

    for (const expense of budgetSpending) {
      const normalizedAmount = getNormalizedAmount(expense);
      allCategoryActual += normalizedAmount;

      if (expense.type !== TransactionType.EXPENSE) {
        continue;
      }

      const categoryId = expense.categoryId || "uncategorized";
      const existing = expensesByCategory.get(categoryId);
      
      if (existing) {
        existing.amount += normalizedAmount;
      } else {
        expensesByCategory.set(categoryId, {
          category: expense.category || { id: "uncategorized", name: "Uncategorized", icon: null, color: null },
          amount: normalizedAmount,
        });
      }
    }

    // Build comparison data
    const comparison: {
      budgetId: string | null;
      budgetName: string | null;
      category: { id: string; name: string; icon: string | null; color: string | null };
      budgeted: number;
      actual: number;
      variance: number;
      percentageUsed: number;
      isOverBudget: boolean;
    }[] = budgets.map((budget) => {
      const expenseData = budget.categoryId
        ? expensesByCategory.get(budget.categoryId)
        : null;
      const actual = budget.categoryId ? expenseData?.amount || 0 : allCategoryActual;
      const variance = budget.amount - actual;

      return {
        budgetId: budget.id,
        budgetName: budget.name,
        category: budget.category || { id: "all-categories", name: "All Categories", icon: null, color: null },
        budgeted: budget.amount,
        actual,
        variance,
        percentageUsed: budget.amount > 0 ? (actual / budget.amount) * 100 : 0,
        isOverBudget: actual > budget.amount,
      };
    });

    // Add categories with expenses but no budget
    for (const [categoryId, data] of expensesByCategory) {
      const hasAllCategoryBudget = budgets.some((b) => b.categoryId === null);
      const hasBudget = hasAllCategoryBudget || budgets.some((b) => b.categoryId === categoryId);
      if (!hasBudget) {
        comparison.push({
          budgetId: null,
          budgetName: null,
          category: data.category,
          budgeted: 0,
          actual: data.amount,
          variance: -data.amount,
          percentageUsed: 100,
          isOverBudget: true,
        });
      }
    }

    return { success: true, data: comparison };
  } catch (error) {
    console.error("Get budget vs actual error:", error);
    return { success: false, error: "Failed to fetch budget vs actual comparison", data: [] };
  }
}

/**
 * Fetches transactions that contribute to a budget's calculated period.
 *
 * @param budgetId - The ID of the budget whose transactions should be retrieved
 * @returns `{ success: true, data: BudgetTransactionListItem[] }` ordered by date descending on success; `{ success: false, error: string, data: [] }` on failure, unauthorized access, or when the budget is not found.
 */
export async function getBudgetTransactions(
  budgetId: string
): Promise<{ success: boolean; data: BudgetTransactionListItem[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId: session.user.id },
    });

    if (!budget) {
      return { success: false, error: "Budget not found", data: [] };
    }

    const { start, end } = getBudgetDateRange(budget);

    const whereClause = {
      userId: session.user.id,
      date: { gte: start, lte: end },
      ...(budget.categoryId
        ? {
            type: TransactionType.EXPENSE,
            categoryId: budget.categoryId,
          }
        : {
            type: { in: BUDGET_SPENDING_TYPES },
          }),
    };

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        currency: true,
        exchangeRate: true,
        type: true,
        description: true,
        date: true,
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
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
          ...transaction.account,
          name: await decryptAccountName(
            session.user.id,
            transaction.account.nameEncrypted
          ),
        },
      }))
    );

    return { success: true, data: decryptedTransactions };
  } catch (error) {
    console.error("Get budget transactions error:", error);
    return { success: false, error: "Failed to fetch budget transactions", data: [] };
  }
}
