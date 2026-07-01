import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  closeDeposito,
  getDepositoInterestHistory,
  getDepositoSummary,
  openDeposito,
  updateDeposito,
} from "@/actions/deposito-actions";
import { accountKeys } from "@/hooks/useAccountQueries";
import { forecastKeys } from "@/hooks/useCashFlowForecast";
import { financialInsightKeys } from "@/hooks/useFinancialInsightQueries";
import { reportKeys } from "@/hooks/useReportQueries";
import { sidebarMetricsKeys } from "@/hooks/useSidebarMetrics";
import { transactionKeys } from "@/hooks/useTransactionQueries";
import { upcomingBankPressureKeys } from "@/hooks/useUpcomingBankPressure";

export const depositoKeys = {
  all: ["deposito"] as const,
  summary: () => [...depositoKeys.all, "summary"] as const,
  history: (limit: number) => [...depositoKeys.all, "history", { limit }] as const,
};

function invalidateDepositoQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: depositoKeys.all });
  queryClient.invalidateQueries({ queryKey: accountKeys.all });
  queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  queryClient.invalidateQueries({ queryKey: forecastKeys.all });
  queryClient.invalidateQueries({ queryKey: upcomingBankPressureKeys.all });
  queryClient.invalidateQueries({ queryKey: reportKeys.all });
  queryClient.invalidateQueries({ queryKey: financialInsightKeys.all });
  queryClient.invalidateQueries({ queryKey: sidebarMetricsKeys.all });
}

export function useDepositoSummary() {
  return useQuery({
    queryKey: depositoKeys.summary(),
    queryFn: async () => {
      const result = await getDepositoSummary();
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
  });
}

export function useDepositoHistory(limit: number = 50) {
  return useQuery({
    queryKey: depositoKeys.history(limit),
    queryFn: async () => {
      const result = await getDepositoInterestHistory(limit);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useOpenDeposito() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Parameters<typeof openDeposito>[0]) => {
      const result = await openDeposito(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      invalidateDepositoQueries(queryClient);
    },
  });
}

export function useUpdateDeposito() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateDeposito>[1];
    }) => {
      const result = await updateDeposito(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      invalidateDepositoQueries(queryClient);
    },
  });
}

export function useCloseDeposito() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof closeDeposito>[1];
    }) => {
      const result = await closeDeposito(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      invalidateDepositoQueries(queryClient);
    },
  });
}
