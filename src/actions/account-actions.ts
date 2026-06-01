"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { encryptUserField, decryptUserField } from "@/lib/user-encryption";
import { getExchangeRate } from "@/lib/finance-service";
import { getCurrentPortfolioValuation } from "@/lib/investment-valuation-service";

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

    // Encrypt sensitive fields
    const encryptedName = validatedFields.data.name
      ? await encryptUserField(session.user.id, "account.name", validatedFields.data.name)
      : null;
    
    const encryptedDescription = validatedFields.data.description
      ? await encryptUserField(session.user.id, "account.description", validatedFields.data.description)
      : null;

    const account = await prisma.financialAccount.create({
      data: {
        ...validatedFields.data,
        // Store encrypted version of name (for security display)
        nameEncrypted: encryptedName,
        // Nullify optional plaintext field after encryption
        description: validatedFields.data.description ? null : undefined,
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

    // Encrypt sensitive fields if provided
    let encryptedName: string | null = null;
    let encryptedDescription: string | null = null;
    
    if (data.name) {
      encryptedName = await encryptUserField(session.user.id, "account.name", data.name);
    }
    if (data.description) {
      encryptedDescription = await encryptUserField(session.user.id, "account.description", data.description);
    }

    const updateData: Record<string, unknown> = { ...data };
    
    // If name is being updated, also store encrypted version
    if (data.name) {
      updateData.nameEncrypted = encryptedName;
    }
    // If description is being updated, nullify plaintext and store encrypted
    if (data.description !== undefined) {
      updateData.description = data.description ? null : undefined;
      updateData.descriptionEncrypted = encryptedDescription;
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

    // Decrypt sensitive fields
    const decryptedAccounts = await Promise.all(
      accounts.map(async (account) => {
        // Use encrypted name if available, otherwise fall back to plaintext
        let finalName = account.name;
        if (account.nameEncrypted) {
          try {
            finalName = await decryptUserField(
              session.user.id,
              "account.name",
              account.nameEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        // Use encrypted description if available, otherwise fall back to plaintext
        let finalDescription = account.description;
        if (account.descriptionEncrypted) {
          try {
            finalDescription = await decryptUserField(
              session.user.id,
              "account.description",
              account.descriptionEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        return {
          ...account,
          name: finalName,
          description: finalDescription,
        };
      })
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

    // Decrypt sensitive fields for accounts
    const decryptedAccounts = await Promise.all(
      accounts.map(async (account) => {
        let finalName = account.name;
        if (account.nameEncrypted) {
          try {
            finalName = await decryptUserField(
              session.user.id,
              "account.name",
              account.nameEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        let finalDescription = account.description;
        if (account.descriptionEncrypted) {
          try {
            finalDescription = await decryptUserField(
              session.user.id,
              "account.description",
              account.descriptionEncrypted
            );
          } catch {
            // Fall back to plaintext
          }
        }

        return {
          ...account,
          name: finalName,
          description: finalDescription,
        };
      })
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

      if (["BANK", "CASH", "INVESTMENT"].includes(account.type)) {
        summary.totalAssets += balance;
      } else {
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
