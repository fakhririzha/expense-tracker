import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLoansReceivableHistory,
  getLoansReceivableSummary,
  recordLoanDisbursement,
  recordReceivableRepayment,
} from "@/actions/receivable-actions";
import { accountKeys } from "./useAccountQueries";
import { transactionKeys } from "./useTransactionQueries";

export const receivableKeys = {
  all: ["receivables"] as const,
  summary: () => [...receivableKeys.all, "summary"] as const,
  history: (limit?: number) => [...receivableKeys.all, "history", { limit }] as const,
};

export function useLoansReceivableSummary() {
  return useQuery({
    queryKey: receivableKeys.summary(),
    queryFn: async () => {
      const result = await getLoansReceivableSummary();
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
  });
}

export function useLoansReceivableHistory(limit: number = 50) {
  return useQuery({
    queryKey: receivableKeys.history(limit),
    queryFn: async () => {
      const result = await getLoansReceivableHistory(limit);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useRecordLoanDisbursement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Parameters<typeof recordLoanDisbursement>[0]) => {
      const result = await recordLoanDisbursement(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: receivableKeys.all });
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useRecordReceivableRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Parameters<typeof recordReceivableRepayment>[0]) => {
      const result = await recordReceivableRepayment(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: receivableKeys.all });
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
