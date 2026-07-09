import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getLiabilityPaymentHistory,
  createLiabilityPayment,
  generatePaymentReference,
} from "@/actions/liability-payment-actions";
import { forecastKeys } from "@/hooks/useCashFlowForecast";
import { debtPlanKeys } from "@/hooks/useDebtPlanQueries";
import { accountKeys } from "./useAccountQueries";
import { transactionKeys } from "./useTransactionQueries";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const liabilityKeys = {
  all: ["liabilities"] as const,
  paymentHistory: (accountId?: string, limit?: number) =>
    [...liabilityKeys.all, "paymentHistory", { accountId, limit }] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useLiabilityPaymentHistory(
  accountId?: string,
  limit: number = 20
) {
  return useQuery({
    queryKey: liabilityKeys.paymentHistory(accountId, limit),
    queryFn: async () => {
      const result = await getLiabilityPaymentHistory(accountId, { limit });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateLiabilityPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Parameters<typeof createLiabilityPayment>[0]
    ) => {
      const result = await createLiabilityPayment(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: liabilityKeys.all });
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: transactionKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
      qc.invalidateQueries({ queryKey: debtPlanKeys.all });
    },
  });
}

export function useGeneratePaymentReference() {
  return useMutation({
    mutationFn: async () => {
      const result = await generatePaymentReference();
      if (!result.success) throw new Error(result.error);
      return result.reference!;
    },
  });
}
