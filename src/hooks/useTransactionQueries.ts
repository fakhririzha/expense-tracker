import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTransactions,
  getTransactionSummary,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/actions/transaction-actions";
import { forecastKeys } from "@/hooks/useCashFlowForecast";
import { accountKeys } from "./useAccountQueries";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...transactionKeys.lists(), filters] as const,
  summary: (startDate?: Date, endDate?: Date) =>
    [...transactionKeys.all, "summary", { startDate, endDate }] as const,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TransactionFilters {
  type?: string;
  categoryId?: string;
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionKeys.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const result = await getTransactions(filters as Parameters<typeof getTransactions>[0]);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useTransactionSummary(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: transactionKeys.summary(startDate, endDate),
    queryFn: async () => {
      const result = await getTransactionSummary(startDate, endDate);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Parameters<typeof createTransaction>[0]) => {
      const result = await createTransaction(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all });
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateTransaction>[1];
    }) => {
      const result = await updateTransaction(id, data);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all });
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteTransaction(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all });
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
    },
  });
}
