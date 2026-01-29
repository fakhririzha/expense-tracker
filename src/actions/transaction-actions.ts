"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Define TransactionType enum locally since Prisma client may not be generated yet
const TransactionTypeEnum = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
  TRANSFER: "TRANSFER",
} as const;

type TransactionType = (typeof TransactionTypeEnum)[keyof typeof TransactionTypeEnum];

const transactionSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("IDR"),
  exchangeRate: z.number().positive().default(1),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  description: z.string().optional(),
  date: z.date().default(() => new Date()),
  accountId: z.string().min(1, "Account is required"),
  categoryId: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringRuleId: z.string().optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export async function createTransaction(data: TransactionInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = transactionSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { amount, type, accountId, ...rest } = validatedFields.data;

    // Verify account belongs to user
    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    // Calculate balance change
    const balanceChange = type === "INCOME" ? amount : -amount;

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          amount,
          type,
          accountId,
          userId: session.user.id,
          ...rest,
        },
      });

      // Update account balance
      await tx.financialAccount.update({
        where: { id: accountId },
        data: { balance: { increment: balanceChange } },
      });

      return transaction;
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");

    return { success: true, data: result };
  } catch (error) {
    console.error("Create transaction error:", error);
    return { success: false, error: "Failed to create transaction" };
  }
}

export async function updateTransaction(
  id: string,
  data: Partial<TransactionInput>
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing transaction
    const existingTransaction = await prisma.transaction.findFirst({
      where: { id, userId: session.user.id },
      include: { account: true },
    });

    if (!existingTransaction) {
      return { success: false, error: "Transaction not found" };
    }

    const { amount, type, accountId, ...rest } = data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Reverse old balance change
      const oldBalanceChange =
        existingTransaction.type === "INCOME"
          ? -existingTransaction.amount
          : existingTransaction.amount;

      await tx.financialAccount.update({
        where: { id: existingTransaction.accountId },
        data: { balance: { increment: oldBalanceChange } },
      });

      // Apply new balance change
      const newAmount = amount ?? existingTransaction.amount;
      const newType = type ?? existingTransaction.type;
      const newAccountId = accountId ?? existingTransaction.accountId;
      const newBalanceChange = newType === "INCOME" ? newAmount : -newAmount;

      await tx.financialAccount.update({
        where: { id: newAccountId },
        data: { balance: { increment: newBalanceChange } },
      });

      // Update transaction
      await tx.transaction.update({
        where: { id },
        data: {
          amount: newAmount,
          type: newType,
          accountId: newAccountId,
          ...rest,
        },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");

    return { success: true };
  } catch (error) {
    console.error("Update transaction error:", error);
    return { success: false, error: "Failed to update transaction" };
  }
}

export async function deleteTransaction(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Reverse balance change
      const balanceChange =
        transaction.type === "INCOME"
          ? -transaction.amount
          : transaction.amount;

      await tx.financialAccount.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: balanceChange } },
      });

      // Delete transaction
      await tx.transaction.delete({ where: { id } });
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transactions");

    return { success: true };
  } catch (error) {
    console.error("Delete transaction error:", error);
    return { success: false, error: "Failed to delete transaction" };
  }
}

export async function getTransactions(options?: {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (options?.accountId) where.accountId = options.accountId;
    if (options?.categoryId) where.categoryId = options.categoryId;
    if (options?.type) where.type = options.type;
    if (options?.startDate || options?.endDate) {
      where.date = {};
      if (options?.startDate)
        (where.date as Record<string, Date>).gte = options.startDate;
      if (options?.endDate)
        (where.date as Record<string, Date>).lte = options.endDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          account: true,
          category: true,
        },
        orderBy: { date: "desc" },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { success: true, data: transactions, total };
  } catch (error) {
    console.error("Get transactions error:", error);
    return { success: false, error: "Failed to fetch transactions", data: [] };
  }
}

interface TransactionSummaryItem {
  amount: number;
  type: string;
  exchangeRate: number;
}

export async function getTransactionSummary(
  startDate?: Date,
  endDate?: Date
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, Date>).gte = startDate;
      if (endDate) (where.date as Record<string, Date>).lte = endDate;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        amount: true,
        type: true,
        exchangeRate: true,
      },
    });

    const summary = transactions.reduce(
      (acc: { totalIncome: number; totalExpense: number }, t: TransactionSummaryItem) => {
        const normalizedAmount = t.amount * t.exchangeRate;
        if (t.type === "INCOME") {
          acc.totalIncome += normalizedAmount;
        } else if (t.type === "EXPENSE") {
          acc.totalExpense += normalizedAmount;
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 }
    );

    return {
      success: true,
      data: {
        ...summary,
        netFlow: summary.totalIncome - summary.totalExpense,
      },
    };
  } catch (error) {
    console.error("Get transaction summary error:", error);
    return { success: false, error: "Failed to fetch summary" };
  }
}
