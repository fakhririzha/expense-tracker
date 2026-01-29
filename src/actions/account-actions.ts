"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Define AccountType enum locally
const AccountTypeEnum = {
  BANK: "BANK",
  CASH: "CASH",
  INVESTMENT: "INVESTMENT",
  LOAN: "LOAN",
  CREDIT_CARD: "CREDIT_CARD",
} as const;

type AccountType = (typeof AccountTypeEnum)[keyof typeof AccountTypeEnum];

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["BANK", "CASH", "INVESTMENT", "LOAN", "CREDIT_CARD"]),
  currency: z.string().default("USD"),
  balance: z.number().default(0),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type AccountInput = z.infer<typeof accountSchema>;

export async function createAccount(data: AccountInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = accountSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const account = await prisma.financialAccount.create({
      data: {
        ...validatedFields.data,
        userId: session.user.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");

    return { success: true, data: account };
  } catch (error) {
    console.error("Create account error:", error);
    return { success: false, error: "Failed to create account" };
  }
}

export async function updateAccount(id: string, data: Partial<AccountInput>) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const existingAccount = await prisma.financialAccount.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingAccount) {
      return { success: false, error: "Account not found" };
    }

    const account = await prisma.financialAccount.update({
      where: { id },
      data,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");

    return { success: true, data: account };
  } catch (error) {
    console.error("Update account error:", error);
    return { success: false, error: "Failed to update account" };
  }
}

export async function deleteAccount(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const account = await prisma.financialAccount.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    // Check if account has transactions
    const transactionCount = await prisma.transaction.count({
      where: { accountId: id },
    });

    if (transactionCount > 0) {
      return {
        success: false,
        error: "Cannot delete account with existing transactions",
      };
    }

    await prisma.financialAccount.delete({ where: { id } });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");

    return { success: true };
  } catch (error) {
    console.error("Delete account error:", error);
    return { success: false, error: "Failed to delete account" };
  }
}

export async function getAccounts(type?: AccountType) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (type) where.type = type;

    const accounts = await prisma.financialAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: accounts };
  } catch (error) {
    console.error("Get accounts error:", error);
    return { success: false, error: "Failed to fetch accounts", data: [] };
  }
}

export async function getAccountsSummary() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const accounts = await prisma.financialAccount.findMany({
      where: { userId: session.user.id, isActive: true },
    });

    interface AccountSummary {
      totalAssets: number;
      totalLiabilities: number;
      byType: Record<string, number>;
    }

    interface AccountItem {
      balance: number;
      type: string;
    }

    const initialSummary: AccountSummary = { totalAssets: 0, totalLiabilities: 0, byType: {} };
    
    const summary = accounts.reduce(
      (acc: AccountSummary, account: AccountItem) => {
        const balance = account.balance;
        
        // Assets: BANK, CASH, INVESTMENT
        // Liabilities: LOAN, CREDIT_CARD
        if (["BANK", "CASH", "INVESTMENT"].includes(account.type)) {
          acc.totalAssets += balance;
        } else {
          acc.totalLiabilities += Math.abs(balance);
        }

        acc.byType[account.type] = (acc.byType[account.type] || 0) + balance;
        return acc;
      },
      initialSummary
    );

    return {
      success: true,
      data: {
        ...summary,
        netWorth: summary.totalAssets - summary.totalLiabilities,
        accounts,
      },
    };
  } catch (error) {
    console.error("Get accounts summary error:", error);
    return { success: false, error: "Failed to fetch summary" };
  }
}
