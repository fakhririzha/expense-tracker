"use server";

import { Prisma, TransactionType } from "@/generated/prisma/client/client";
import { decryptAccountName } from "@/lib/account-crypto";
import {
  calculateBankInterest,
  getCurrentJakartaBoundary,
  getNextBankInterestDate,
} from "@/lib/bank-interest";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import { encryptUserField } from "@/lib/user-encryption";
import { revalidatePath } from "next/cache";

async function getBankInterestCategory(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<string> {
  const existing = await tx.category.findFirst({
    where: {
      userId,
      type: TransactionType.INCOME,
      name: "Bank Interest",
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const category = await tx.category.create({
    data: {
      userId,
      name: "Bank Interest",
      icon: "🏦",
      color: "#0f766e",
      type: TransactionType.INCOME,
      isSystem: true,
    },
    select: { id: true },
  });

  return category.id;
}

function revalidateBankInterestPaths(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/insights");
  revalidatePath("/dashboard/calendar");
}

export async function isManagedBankInterestTransaction(
  userId: string,
  transactionId: string
): Promise<boolean> {
  const posting = await prisma.bankInterestPosting.findFirst({
    where: { transactionId, userId },
    select: { id: true },
  });
  return Boolean(posting);
}

export async function processBankInterest() {
  try {
    const currentBoundary = getCurrentJakartaBoundary();
    const dueSettings = await prisma.bankInterestSetting.findMany({
      where: {
        enabled: true,
        nextPostingDate: { lte: currentBoundary },
      },
      select: { id: true },
    });

    const results = {
      processedAccounts: 0,
      postedTransactions: 0,
      skippedBalances: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const dueSetting of dueSettings) {
      try {
        const processed = await prisma.$transaction(
          async (tx) => {
            const setting = await tx.bankInterestSetting.findUnique({
              where: { id: dueSetting.id },
              include: {
                user: { select: { id: true, mainCurrency: true } },
                account: {
                  select: {
                    id: true,
                    type: true,
                    isActive: true,
                    currency: true,
                    balance: true,
                    nameEncrypted: true,
                  },
                },
              },
            });

            if (!setting?.enabled || !setting.nextPostingDate) {
              return { posted: 0, skipped: 0 };
            }

            if (setting.account.type !== "BANK" || !setting.account.isActive) {
              await tx.bankInterestSetting.update({
                where: { id: setting.id },
                data: { nextPostingDate: null },
              });
              return { posted: 0, skipped: 0 };
            }

            const categoryId = await getBankInterestCategory(tx, setting.userId);
            const accountName = await decryptAccountName(
              setting.userId,
              setting.account.nameEncrypted
            );
            const exchangeRate =
              setting.account.currency === setting.user.mainCurrency
                ? 1
                : (await getExchangeRate(
                    setting.account.currency,
                    setting.user.mainCurrency
                  )) ?? 1;

            let currentBalance = setting.account.balance;
            let currentDueDate = setting.nextPostingDate;
            let posted = 0;
            let skipped = 0;

            while (currentDueDate.getTime() <= currentBoundary.getTime()) {
              const interestAmount =
                currentBalance > 0
                  ? calculateBankInterest({
                      balance: currentBalance,
                      annualRate: setting.annualRate,
                      frequency: setting.frequency,
                    })
                  : 0;

              if (interestAmount > 0) {
                const descriptionEncrypted = await encryptUserField(
                  setting.userId,
                  "transaction.description",
                  `Bank interest for ${accountName}`
                );
                const transaction = await tx.transaction.create({
                  data: {
                    amount: interestAmount,
                    currency: setting.account.currency,
                    exchangeRate,
                    type: TransactionType.INCOME,
                    description: null,
                    descriptionEncrypted,
                    date: currentDueDate,
                    userId: setting.userId,
                    accountId: setting.account.id,
                    categoryId,
                  },
                });
                const balanceAfter =
                  Math.round(
                    (currentBalance + interestAmount + Number.EPSILON) * 10000
                  ) / 10000;

                await tx.financialAccount.update({
                  where: { id: setting.account.id },
                  data: { balance: { increment: interestAmount } },
                });
                await tx.bankInterestPosting.create({
                  data: {
                    postingDate: currentDueDate,
                    annualRate: setting.annualRate,
                    balanceBefore: currentBalance,
                    interestAmount,
                    balanceAfter,
                    userId: setting.userId,
                    accountId: setting.account.id,
                    transactionId: transaction.id,
                  },
                });

                currentBalance = balanceAfter;
                posted += 1;
              } else {
                skipped += 1;
              }

              currentDueDate = getNextBankInterestDate(
                currentDueDate,
                setting.frequency
              );
            }

            await tx.bankInterestSetting.update({
              where: { id: setting.id },
              data: { nextPostingDate: currentDueDate },
            });

            return { posted, skipped };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000,
          }
        );

        results.processedAccounts += 1;
        results.postedTransactions += processed.posted;
        results.skippedBalances += processed.skipped;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        results.failed += 1;
        results.errors.push(
          `Bank interest setting ${dueSetting.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    if (results.postedTransactions > 0) {
      revalidateBankInterestPaths();
    }

    return { success: true, data: results };
  } catch (error) {
    console.error("Process bank interest error:", error);
    return { success: false, error: "Failed to process bank interest." };
  }
}
