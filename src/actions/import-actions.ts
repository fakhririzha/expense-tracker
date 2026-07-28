"use server";

import { createTransaction } from "@/actions/transaction-actions";
import { auth } from "@/auth";
import { verifyAccountMutationConfirmation } from "@/lib/account-mutation-totp";
import {
  decryptAccountRecords,
  encryptAccountName,
} from "@/lib/account-crypto";
import prisma from "@/lib/db";
import {
  previewImport,
  validateImportTransactionsInput,
} from "@/lib/transaction-import";
import type {
  ImportResult,
  ImportTransactionsInput,
} from "@/lib/transaction-import";

interface AccountLookupItem {
  id: string;
  name: string;
  currency: string;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function failedImport(error: string): ImportResult {
  return {
    success: false,
    imported: 0,
    failed: 0,
    errors: [{ row: 0, error }],
  };
}

export async function importTransactions(
  input: ImportTransactionsInput
): Promise<ImportResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return failedImport("Unauthorized");

    const inputResult = validateImportTransactionsInput(input);
    if (!inputResult.success) return failedImport(inputResult.error);

    const { csvContent, mapping, options, confirmation } = inputResult.data;
    const preview = previewImport(csvContent, mapping);
    if (!preview.success) {
      return failedImport(preview.error || "Failed to parse CSV");
    }
    if (options?.createMissingAccounts) {
      const confirmationResult = await verifyAccountMutationConfirmation(
        session.user.id,
        session.user.email ?? "",
        confirmation
      );
      if (!confirmationResult.success) {
        return failedImport(confirmationResult.error ?? "Confirmation failed");
      }
    }
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
    };

    const [existingAccounts, existingCategories] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          nameEncrypted: true,
          descriptionEncrypted: true,
          currency: true,
        },
      }),
      prisma.category.findMany({
        where: { userId: session.user.id },
        select: { id: true, name: true, type: true },
      }),
    ]);

    const decryptedAccounts = await decryptAccountRecords(
      session.user.id,
      existingAccounts
    );
    const accountMap = new Map<string, AccountLookupItem>(
      decryptedAccounts.map((account) => [account.name.toLowerCase(), account])
    );
    const categoryMap = new Map(
      existingCategories.map((category) => [
        `${category.type}:${category.name.toLowerCase()}`,
        category,
      ])
    );

    for (const transaction of preview.transactions) {
      if (!transaction.isValid) {
        result.failed++;
        result.errors.push({
          row: transaction.rowNumber,
          error: transaction.errors.join(", "),
        });
        continue;
      }

      try {
        const accountName = transaction.account.trim();
        let account = accountMap.get(accountName.toLowerCase());

        if (!account && options?.createMissingAccounts) {
          const createdAccount = await prisma.financialAccount.create({
            data: {
              nameEncrypted: await encryptAccountName(session.user.id, accountName),
              type: "BANK",
              currency: transaction.currency || "IDR",
              balance: 0,
              userId: session.user.id,
            },
          });
          account = {
            id: createdAccount.id,
            name: accountName,
            currency: createdAccount.currency,
          };
          accountMap.set(accountName.toLowerCase(), account);
        } else if (!account) {
          result.failed++;
          result.errors.push({
            row: transaction.rowNumber,
            error: `Account "${accountName}" not found`,
          });
          continue;
        }

        let toAccount: AccountLookupItem | null = null;
        if (transaction.type === "TRANSFER" && transaction.toAccount) {
          const toAccountName = transaction.toAccount.trim();
          toAccount = accountMap.get(toAccountName.toLowerCase()) ?? null;

          if (!toAccount && options?.createMissingAccounts) {
            const createdToAccount = await prisma.financialAccount.create({
              data: {
                nameEncrypted: await encryptAccountName(
                  session.user.id,
                  toAccountName
                ),
                type: "BANK",
                currency: transaction.currency || "IDR",
                balance: 0,
                userId: session.user.id,
              },
            });
            toAccount = {
              id: createdToAccount.id,
              name: toAccountName,
              currency: createdToAccount.currency,
            };
            accountMap.set(toAccountName.toLowerCase(), toAccount);
          } else if (!toAccount) {
            result.failed++;
            result.errors.push({
              row: transaction.rowNumber,
              error: `Destination account "${toAccountName}" not found`,
            });
            continue;
          }
        }

        let categoryId: string | undefined;
        if (transaction.category) {
          if (transaction.type === "TRANSFER") {
            result.failed++;
            result.errors.push({
              row: transaction.rowNumber,
              error: "Transfers cannot include a category",
            });
            continue;
          }

          const categoryName = transaction.category.trim();
          const categoryKey = `${transaction.type}:${categoryName.toLowerCase()}`;
          let category = categoryMap.get(categoryKey);

          if (!category && options?.createMissingCategories) {
            category = await prisma.category.create({
              data: {
                name: categoryName,
                type: transaction.type as "INCOME" | "EXPENSE",
                userId: session.user.id,
              },
            });
            categoryMap.set(categoryKey, category);
          }

          if (!category) {
            result.failed++;
            result.errors.push({
              row: transaction.rowNumber,
              error: `Category "${categoryName}" not found`,
            });
            continue;
          }

          categoryId = category.id;
        }

        if (transaction.currency !== account.currency) {
          result.failed++;
          result.errors.push({
            row: transaction.rowNumber,
            error: `Currency "${transaction.currency}" does not match account currency "${account.currency}"`,
          });
          continue;
        }

        if (
          transaction.type === "TRANSFER" &&
          toAccount?.currency !== account.currency
        ) {
          result.failed++;
          result.errors.push({
            row: transaction.rowNumber,
            error: "Source and destination accounts must use the same currency",
          });
          continue;
        }

        const transactionResult = await createTransaction({
          amount: transaction.amount,
          currency: transaction.currency || account.currency,
          exchangeRate: 1,
          type: transaction.type as "INCOME" | "EXPENSE" | "TRANSFER",
          description: transaction.description,
          location: transaction.location,
          latitude: parseOptionalNumber(transaction.latitude),
          longitude: parseOptionalNumber(transaction.longitude),
          googleMapsLink: transaction.googleMapsLink,
          date: new Date(transaction.date),
          accountId: account.id,
          toAccountId:
            transaction.type === "TRANSFER" ? toAccount?.id : undefined,
          categoryId,
          isRecurring: false,
        });

        if (!transactionResult.success) {
          result.failed++;
          result.errors.push({
            row: transaction.rowNumber,
            error: transactionResult.error || "Failed to import transaction",
          });
          continue;
        }

        result.imported++;
      } catch (error) {
        console.error(`Error importing row ${transaction.rowNumber}:`, error);
        result.failed++;
        result.errors.push({
          row: transaction.rowNumber,
          error: "Failed to import transaction",
        });
      }
    }

    result.success = result.imported > 0;
    return result;
  } catch (error) {
    console.error("Import transactions error:", error);
    return failedImport("Failed to import transactions");
  }
}
