import { Prisma, type AccountType } from "@/generated/prisma/client/client";
import { decryptAccountName } from "@/lib/account-crypto";
import { getManagedDepositoTransactionIds } from "@/lib/deposito-managed-transactions";
import prisma from "@/lib/db";
import { isEncryptionConfigurationError } from "@/lib/encryption";
import { decryptUserField } from "@/lib/user-encryption";
import {
  deriveMobileTransactionCapabilities,
  type TransactionCapabilities,
  getBankInterestManagedTransactionIds,
} from "@/server/transactions/transaction-capabilities";
import {
  getTransactionsForUser as getTransactionsFromService,
} from "@/server/transactions/transaction-service";

import type {
  PaginatedTransactionsData,
  TransactionListItem,
  TransactionListQueryParams,
} from "@/types/transaction-list";

export type CapableTransactionListItem = Omit<
  TransactionListItem,
  "account" | "toAccount"
> & {
  account: {
    id: string;
    name: string;
    type: AccountType;
  };
  toAccount: {
    id: string;
    name: string;
    type: AccountType;
  } | null;
  capabilities: TransactionCapabilities;
};

export type CapableTransactionPage = Omit<
  PaginatedTransactionsData,
  "transactions"
> & {
  transactions: CapableTransactionListItem[];
};

export async function getTransactionsForUser(
  userId: string,
  options?: TransactionListQueryParams
): Promise<
  | { success: true; data: CapableTransactionPage }
  | { success: false; error: string; data: PaginatedTransactionsData }
> {
  const result = await getTransactionsFromService(userId, options);
  if (!result.success) return result;

  const transactionIds = result.data.transactions.map((transaction) => transaction.id);
  const bankInterestIds = await getBankInterestManagedTransactionIds(
    userId,
    transactionIds
  );

  return {
    success: true as const,
    data: {
      ...result.data,
      transactions: result.data.transactions.map((transaction) => ({
        ...transaction,
        toAccount: transaction.toAccount
          ? { ...transaction.toAccount, name: transaction.toAccount.name ?? "" }
          : null,
        capabilities: deriveMobileTransactionCapabilities({
          type: transaction.type,
          accountType: transaction.account.type,
          toAccountType: transaction.toAccount?.type,
          hasSplits: transaction.splits.length > 0,
          isManagedByDeposito: transaction.isManagedByDeposito,
          isManagedByBankInterest: bankInterestIds.has(transaction.id),
        }),
      })),
    },
  };
}

async function decryptOptionalField(
  userId: string,
  fieldName:
    | "transaction.description"
    | "transaction.referenceNumber"
    | "transaction.createdBy"
    | "transactionSplit.description",
  encryptedValue: string | null,
  fallbackValue: string | null
): Promise<string | null> {
  if (!encryptedValue) return fallbackValue;

  try {
    return await decryptUserField(userId, fieldName, encryptedValue);
  } catch (error) {
    if (isEncryptionConfigurationError(error)) throw error;
    return fallbackValue;
  }
}

export async function getTransactionForUser(userId: string, id: string) {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id, userId },
      select: {
        id: true,
        amount: true,
        currency: true,
        exchangeRate: true,
        type: true,
        description: true,
        descriptionEncrypted: true,
        location: true,
        latitude: true,
        longitude: true,
        googleMapsLink: true,
        date: true,
        isRecurring: true,
        toAccountId: true,
        referenceNumber: true,
        referenceNumberEncrypted: true,
        createdBy: true,
        createdByEncrypted: true,
        account: {
          select: { id: true, nameEncrypted: true, type: true },
        },
        toAccount: {
          select: { id: true, nameEncrypted: true, type: true },
        },
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        splits: {
          select: {
            id: true,
            amount: true,
            description: true,
            descriptionEncrypted: true,
            sortOrder: true,
            categoryId: true,
            category: {
              select: { id: true, name: true, icon: true, color: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      } satisfies Prisma.TransactionSelect,
    });

    if (!transaction) {
      return { success: false as const, error: "Transaction not found" };
    }

    const [managedDepositoIds, bankInterestIds] = await Promise.all([
      getManagedDepositoTransactionIds(userId, [id]),
      getBankInterestManagedTransactionIds(userId, [id]),
    ]);
    const [description, referenceNumber, createdBy, accountName, toAccountName, splits] =
      await Promise.all([
        decryptOptionalField(
          userId,
          "transaction.description",
          transaction.descriptionEncrypted,
          transaction.description
        ),
        decryptOptionalField(
          userId,
          "transaction.referenceNumber",
          transaction.referenceNumberEncrypted,
          transaction.referenceNumber
        ),
        decryptOptionalField(
          userId,
          "transaction.createdBy",
          transaction.createdByEncrypted,
          transaction.createdBy
        ),
        decryptAccountName(userId, transaction.account.nameEncrypted),
        transaction.toAccount
          ? decryptAccountName(userId, transaction.toAccount.nameEncrypted)
          : Promise.resolve(null),
        Promise.all(
          transaction.splits.map(async (split) => ({
            id: split.id,
            amount: split.amount,
            description: await decryptOptionalField(
              userId,
              "transactionSplit.description",
              split.descriptionEncrypted,
              split.description
            ),
            sortOrder: split.sortOrder,
            categoryId: split.categoryId,
            category: split.category,
          }))
        ),
      ]);

    const isManagedByDeposito = managedDepositoIds.has(id);
    return {
      success: true as const,
      data: {
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        exchangeRate: transaction.exchangeRate,
        type: transaction.type,
        description,
        location: transaction.location,
        latitude: transaction.latitude,
        longitude: transaction.longitude,
        googleMapsLink: transaction.googleMapsLink,
        date: transaction.date,
        isRecurring: transaction.isRecurring,
        isManagedByDeposito,
        toAccountId: transaction.toAccountId,
        referenceNumber,
        createdBy,
        account: {
          id: transaction.account.id,
          name: accountName,
          type: transaction.account.type,
        },
        toAccount: transaction.toAccount
          ? {
              id: transaction.toAccount.id,
              name: toAccountName ?? "",
              type: transaction.toAccount.type,
            }
          : null,
        category: transaction.category,
        splits,
        capabilities: deriveMobileTransactionCapabilities({
          type: transaction.type,
          accountType: transaction.account.type,
          toAccountType: transaction.toAccount?.type,
          hasSplits: transaction.splits.length > 0,
          isManagedByDeposito,
          isManagedByBankInterest: bankInterestIds.has(id),
        }),
      },
    };
  } catch (error) {
    console.error("Get transaction error:", error);
    return { success: false as const, error: "Failed to fetch transaction" };
  }
}
