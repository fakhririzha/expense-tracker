"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { TransactionType } from "@prisma/client";
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

// Get all budgets for the current user
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

// Get a single budget by ID
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

// Create a new budget
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

    // Validate category belongs to user OR is a system category (IDOR prevention)
    const { categoryId, ...restData } = validatedFields.data;
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          OR: [{ userId: session.user.id }, { isSystem: true }],
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

// Update an existing budget
export async function updateBudget(id: string, data: Partial<BudgetInput>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const existingBudget = await prisma.budget.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingBudget) {
      return { success: false, error: "Budget not found" };
    }

    // Validate category belongs to user OR is a system category (IDOR prevention)
    if (data.categoryId !== undefined) {
      const sanitizedCategoryId = data.categoryId?.trim() || null;
      if (sanitizedCategoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: sanitizedCategoryId,
            OR: [{ userId: session.user.id }, { isSystem: true }],
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

// Delete a budget
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

// Helper function to get date range for budget period
function getBudgetDateRange(budget: { period: string; startDate: Date }): { start: Date; end: Date } {
  const now = new Date();
  
  switch (budget.period) {
    case "MONTHLY":
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    case "QUARTERLY":
      return {
        start: startOfQuarter(now),
        end: endOfQuarter(now),
      };
    case "YEARLY":
      return {
        start: startOfYear(now),
        end: endOfYear(now),
      };
    default:
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
  }
}

// Get spending progress for a single budget
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
    const whereClause: {
      userId: string;
      type: TransactionType;
      date: { gte: Date; lte: Date };
      categoryId?: string;
    } = {
      userId: session.user.id,
      type: TransactionType.EXPENSE,
      date: { gte: start, lte: end },
    };

    // If budget has a category, filter by it
    if (budget.categoryId) {
      whereClause.categoryId = budget.categoryId;
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      select: {
        amount: true,
        date: true,
      },
    });

    // Calculate spent amount
    const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
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

// Get all budgets with their progress (optimized - single query for transactions)
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

    // 5. Fetch all relevant transactions in a single query
    const allTransactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: TransactionType.EXPENSE,
        date: { gte: minDate, lte: maxDate },
        // Only filter by categoryId if there are category-specific budgets
        ...(categoryIds.length > 0 && { categoryId: { in: categoryIds } }),
      },
      select: {
        amount: true,
        date: true,
        categoryId: true,
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
      const spent = budgetTransactions.reduce((sum, t) => sum + t.amount, 0);
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

// Get budget vs actual comparison by category
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

    // Get all expenses for the current month grouped by category
    const expenses = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: "EXPENSE",
        date: { gte: monthStart, lte: monthEnd },
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

    // Group expenses by category
    const expensesByCategory = new Map<string, { category: { id: string; name: string; icon: string | null; color: string | null }; amount: number }>();

    for (const expense of expenses) {
      const categoryId = expense.categoryId || "uncategorized";
      const existing = expensesByCategory.get(categoryId);
      
      if (existing) {
        existing.amount += expense.amount;
      } else {
        expensesByCategory.set(categoryId, {
          category: expense.category || { id: "uncategorized", name: "Uncategorized", icon: null, color: null },
          amount: expense.amount,
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
      const categoryId = budget.categoryId || "uncategorized";
      const expenseData = expensesByCategory.get(categoryId);
      const actual = expenseData?.amount || 0;
      const variance = budget.amount - actual;

      return {
        budgetId: budget.id,
        budgetName: budget.name,
        category: budget.category || { id: "uncategorized", name: "Uncategorized", icon: null, color: null },
        budgeted: budget.amount,
        actual,
        variance,
        percentageUsed: budget.amount > 0 ? (actual / budget.amount) * 100 : 0,
        isOverBudget: actual > budget.amount,
      };
    });

    // Add categories with expenses but no budget
    for (const [categoryId, data] of expensesByCategory) {
      const hasBudget = budgets.some((b) => (b.categoryId || "uncategorized") === categoryId);
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

// Get transactions for a specific budget
export async function getBudgetTransactions(budgetId: string) {
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

    const whereClause: {
      userId: string;
      type: TransactionType;
      date: { gte: Date; lte: Date };
      categoryId?: string;
    } = {
      userId: session.user.id,
      type: TransactionType.EXPENSE,
      date: { gte: start, lte: end },
    };

    if (budget.categoryId) {
      whereClause.categoryId = budget.categoryId;
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
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
            name: true,
            currency: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return { success: true, data: transactions };
  } catch (error) {
    console.error("Get budget transactions error:", error);
    return { success: false, error: "Failed to fetch budget transactions", data: [] };
  }
}
