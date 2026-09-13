"use server";

import { auth } from "@/auth";
import {
  createTransactionForUser,
  deleteTransactionForUser,
  getTransactionSummaryForUser,
  updateTransactionForUser,
  type TransactionInput,
} from "@/server/transactions/transaction-service";
import { getTransactionsForUser } from "@/server/transactions/transaction-query-service";
import { revalidateTransactionPaths } from "@/server/transactions/transaction-revalidation";

import type { TransactionListQueryParams } from "@/types/transaction-list";

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function createTransaction(data: TransactionInput) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false as const, error: "Unauthorized" };

  const result = await createTransactionForUser(userId, data);
  if (result.success) revalidateTransactionPaths();
  return result;
}

export async function updateTransaction(
  id: string,
  data: Partial<TransactionInput>
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false as const, error: "Unauthorized" };

  const result = await updateTransactionForUser(userId, id, data);
  if (result.success) revalidateTransactionPaths();
  return result;
}

export async function deleteTransaction(id: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false as const, error: "Unauthorized" };

  const result = await deleteTransactionForUser(userId, id);
  if (result.success) revalidateTransactionPaths();
  return result;
}

export async function getTransactions(options?: TransactionListQueryParams) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      success: false as const,
      error: "Unauthorized",
      data: {
        transactions: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    };
  }

  return getTransactionsForUser(userId, options);
}

export async function getTransactionSummary(startDate?: Date, endDate?: Date) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { success: false as const, error: "Unauthorized" };
  return getTransactionSummaryForUser(userId, startDate, endDate);
}
