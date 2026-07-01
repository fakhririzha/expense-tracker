"use server";

import { auth } from "@/auth";
import {
  decryptAccountRecords,
  encryptAccountDescription,
  encryptAccountName,
} from "@/lib/account-crypto";
import {
  ACCOUNT_TYPES,
  type AccountTypeValue,
  isDepositoAccountType,
  isAssetAccountType,
  isLiabilityAccountType,
  normalizeAccountBalanceForType,
} from "@/lib/account-types";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import { getCurrentPortfolioValuation } from "@/lib/investment-valuation-service";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.string().default("IDR"),
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

    if (isDepositoAccountType(validatedFields.data.type)) {
      return {
        success: false,
        error: "Use Deposito Tracker to create deposito accounts.",
      };
    }

    // Encrypt sensitive fields
    const encryptedName = await encryptAccountName(
      session.user.id,
      validatedFields.data.name
    );
    const encryptedDescription = await encryptAccountDescription(
      session.user.id,
      validatedFields.data.description ?? null
    );

    const account = await prisma.financialAccount.create({
      data: {
        type: validatedFields.data.type,
        currency: validatedFields.data.currency,
        isActive: validatedFields.data.isActive,
        balance: normalizeAccountBalanceForType(
          validatedFields.data.type,
          validatedFields.data.balance
        ),
        nameEncrypted: encryptedName,
        descriptionEncrypted: encryptedDescription,
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

    if (
      isDepositoAccountType(existingAccount.type) ||
      isDepositoAccountType(data.type ?? existingAccount.type)
    ) {
      return {
        success: false,
        error: "Manage deposito accounts from the Deposito Tracker page.",
      };
    }

    // Encrypt sensitive fields if provided
    const updateData: Record<string, unknown> = {};
    const nextType = data.type ?? existingAccount.type;

    if (data.type !== undefined) {
      updateData.type = data.type;
    }
    if (data.currency !== undefined) {
      updateData.currency = data.currency;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.balance !== undefined) {
      updateData.balance = normalizeAccountBalanceForType(nextType, data.balance);
    } else if (data.type !== undefined) {
      updateData.balance = normalizeAccountBalanceForType(
        nextType,
        existingAccount.balance
      );
    }
    
    // If name is being updated, also store encrypted version
    if (data.name !== undefined) {
      updateData.nameEncrypted = await encryptAccountName(
        session.user.id,
        data.name
      );
    }
    if (data.description !== undefined) {
      updateData.descriptionEncrypted = await encryptAccountDescription(
        session.user.id,
        data.description ?? null
      );
    }

    const account = await prisma.financialAccount.update({
      where: { id },
      data: updateData,
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
      include: {
        depositoAccount: {
          select: { id: true },
        },
      },
    });

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    if (account.depositoAccount) {
      return {
        success: false,
        error: "Manage deposito accounts from the Deposito Tracker page.",
      };
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

export async function getAccounts(type?: AccountTypeValue) {
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

    const decryptedAccounts = await decryptAccountRecords(
      session.user.id,
      accounts
    );

    return { success: true, data: decryptedAccounts };
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

    const [user, accounts, personalAssets] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { mainCurrency: true },
      }),
      prisma.financialAccount.findMany({
        where: { userId: session.user.id, isActive: true },
      }),
      prisma.personalAsset.findMany({
        where: { userId: session.user.id, disposedAt: null },
        select: { currentValue: true, currency: true },
      }),
    ]);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const decryptedAccounts = await decryptAccountRecords(
      session.user.id,
      accounts
    );

    interface AccountSummary {
      totalAssets: number;
      totalLiabilities: number;
      byType: Record<string, number>;
    }

    interface AccountItem {
      balance: number;
      type: string;
      currency: string;
    }

    const initialSummary: AccountSummary = { totalAssets: 0, totalLiabilities: 0, byType: {} };
    
    const summary = initialSummary;
    for (const account of accounts as AccountItem[]) {
      const rate =
        account.currency === user.mainCurrency
          ? 1
          : (await getExchangeRate(account.currency, user.mainCurrency)) ?? 1;
      const balance = account.balance * rate;

      if (isAssetAccountType(account.type)) {
        summary.totalAssets += balance;
      } else if (isLiabilityAccountType(account.type)) {
        summary.totalLiabilities += Math.abs(balance);
      }

      summary.byType[account.type] = (summary.byType[account.type] || 0) + balance;
    }

    let totalPersonalAssets = 0;
    for (const asset of personalAssets) {
      const rate =
        asset.currency === user.mainCurrency
          ? 1
          : (await getExchangeRate(asset.currency, user.mainCurrency)) ?? 1;
      totalPersonalAssets += asset.currentValue * rate;
    }
    summary.totalAssets += totalPersonalAssets;
    summary.byType.PERSONAL_ASSET = totalPersonalAssets;

    let totalInvestments: number | null = null;
    let valuationError: string | null = null;
    try {
      const portfolio = await getCurrentPortfolioValuation(
        session.user.id,
        user.mainCurrency
      );
      totalInvestments = portfolio.summary.totalValue;
      summary.totalAssets += totalInvestments;
      summary.byType.INVESTMENT_HOLDINGS = totalInvestments;
    } catch (error) {
      console.error("Get accounts portfolio valuation error:", error);
      valuationError =
        error instanceof Error
          ? error.message
          : "Current investment valuation is unavailable";
    }

    const totalAssets = totalInvestments === null ? null : summary.totalAssets;

    return {
      success: true,
      data: {
        ...summary,
        totalAssets,
        netWorth:
          totalAssets === null ? null : totalAssets - summary.totalLiabilities,
        totalInvestments,
        totalPersonalAssets,
        valuationError,
        displayCurrency: user.mainCurrency,
        accounts: decryptedAccounts,
      },
    };
  } catch (error) {
    console.error("Get accounts summary error:", error);
    return { success: false, error: "Failed to fetch summary" };
  }
}
