"use server";

import { auth } from "@/auth";
import { Prisma, TransactionType } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import { decryptUserField, encryptUserField } from "@/lib/user-encryption";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const receivableTransferSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  sourceAccountId: z.string().min(1, "Source account is required"),
  targetAccountId: z.string().min(1, "Target account is required"),
  description: z.string().optional(),
  date: z.date().default(() => new Date()),
});

export type ReceivableTransferInput = z.infer<typeof receivableTransferSchema>;

type TransferMode = "DISBURSEMENT" | "REPAYMENT";

interface AccountLike {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  isActive: boolean;
  userId: string;
}

function isLiquidFundingAccount(account: AccountLike) {
  return account.type === "BANK" || account.type === "CASH";
}

function isReceivableAccount(account: AccountLike) {
  return account.type === "LOAN_RECEIVABLE";
}

function validateReceivableTransfer(
  mode: TransferMode,
  sourceAccount: AccountLike,
  targetAccount: AccountLike,
  amount: number
): string | null {
  if (!sourceAccount.isActive || !targetAccount.isActive) {
    return "Both accounts must be active.";
  }

  if (sourceAccount.id === targetAccount.id) {
    return "Source and target accounts must be different.";
  }

  if (sourceAccount.currency !== targetAccount.currency) {
    return "Loans Receivable currently supports transfers between accounts with the same currency.";
  }

  if (mode === "DISBURSEMENT") {
    if (!isLiquidFundingAccount(sourceAccount) || !isReceivableAccount(targetAccount)) {
      return "Lending must move funds from a bank or cash account into a Loans Receivable account.";
    }

    if (sourceAccount.balance < amount) {
      return `Insufficient funds in "${sourceAccount.name}".`;
    }
  } else {
    if (!isReceivableAccount(sourceAccount) || !isLiquidFundingAccount(targetAccount)) {
      return "Repayment must move funds from a Loans Receivable account into a bank or cash account.";
    }

    if (sourceAccount.balance < amount) {
      return `Repayment exceeds the outstanding balance for "${sourceAccount.name}".`;
    }
  }

  return null;
}

async function recordReceivableTransfer(
  data: ReceivableTransferInput,
  mode: TransferMode
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validatedFields = receivableTransferSchema.safeParse(data);
    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.issues[0].message,
      };
    }

    const { amount, sourceAccountId, targetAccountId, description, date } =
      validatedFields.data;
    const userId = session.user.id;

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const [sourceAccount, targetAccount] = await Promise.all([
          tx.financialAccount.findFirst({
            where: { id: sourceAccountId, userId },
          }),
          tx.financialAccount.findFirst({
            where: { id: targetAccountId, userId },
          }),
        ]);

        if (!sourceAccount || !targetAccount) {
          throw new Error("Account not found");
        }

        const validationError = validateReceivableTransfer(
          mode,
          sourceAccount,
          targetAccount,
          amount
        );
        if (validationError) {
          throw new Error(validationError);
        }

        const encryptedDescription = description
          ? await encryptUserField(userId, "transaction.description", description)
          : null;

        const transaction = await tx.transaction.create({
          data: {
            amount,
            currency: sourceAccount.currency,
            exchangeRate: 1,
            type: TransactionType.TRANSFER,
            description: null,
            descriptionEncrypted: encryptedDescription,
            date,
            userId,
            accountId: sourceAccountId,
            toAccountId: targetAccountId,
          },
        });

        const updatedSource = await tx.financialAccount.update({
          where: { id: sourceAccountId },
          data: { balance: { decrement: amount } },
        });

        const updatedTarget = await tx.financialAccount.update({
          where: { id: targetAccountId },
          data: { balance: { increment: amount } },
        });

        return {
          transaction,
          sourceBalanceAfter: updatedSource.balance,
          targetBalanceAfter: updatedTarget.balance,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/receivables");

    return { success: true, data: result };
  } catch (error) {
    console.error("Record receivable transfer error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to record Loans Receivable transfer",
    };
  }
}

export async function recordLoanDisbursement(data: ReceivableTransferInput) {
  return recordReceivableTransfer(data, "DISBURSEMENT");
}

export async function recordReceivableRepayment(data: ReceivableTransferInput) {
  return recordReceivableTransfer(data, "REPAYMENT");
}

export async function getLoansReceivableSummary() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mainCurrency: true },
    });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const accounts = await prisma.financialAccount.findMany({
      where: {
        userId: session.user.id,
        type: "LOAN_RECEIVABLE",
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    let totalOutstanding = 0;
    for (const account of accounts) {
      const rate =
        account.currency === user.mainCurrency
          ? 1
          : (await getExchangeRate(account.currency, user.mainCurrency)) ?? 1;
      totalOutstanding += account.balance * rate;
    }

    return {
      success: true,
      data: {
        totalOutstanding,
        activeCount: accounts.length,
        accountCount: accounts.length,
        displayCurrency: user.mainCurrency,
        accounts,
      },
    };
  } catch (error) {
    console.error("Get loans receivable summary error:", error);
    return { success: false, error: "Failed to fetch Loans Receivable summary" };
  }
}

export async function getLoansReceivableHistory(limit: number = 50) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized", data: [] };
    }

    const receivableAccounts = await prisma.financialAccount.findMany({
      where: {
        userId: session.user.id,
        type: "LOAN_RECEIVABLE",
      },
      select: { id: true },
    });
    const receivableAccountIds = receivableAccounts.map((account) => account.id);

    if (receivableAccountIds.length === 0) {
      return { success: true, data: [] };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: session.user.id,
        type: "TRANSFER",
        OR: [
          { accountId: { in: receivableAccountIds } },
          { toAccountId: { in: receivableAccountIds } },
        ],
      },
      include: {
        account: true,
        toAccount: true,
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    const decryptedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        let finalDescription = transaction.description;
        if (transaction.descriptionEncrypted) {
          try {
            finalDescription = await decryptUserField(
              session.user.id,
              "transaction.description",
              transaction.descriptionEncrypted
            );
          } catch {
            finalDescription = transaction.description;
          }
        }

        return {
          ...transaction,
          description: finalDescription,
        };
      })
    );

    return { success: true, data: decryptedTransactions };
  } catch (error) {
    console.error("Get loans receivable history error:", error);
    return { success: false, error: "Failed to fetch Loans Receivable history", data: [] };
  }
}
