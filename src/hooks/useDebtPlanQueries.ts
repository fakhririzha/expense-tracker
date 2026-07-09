import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDebtPlan,
  deleteDebtPlan,
  getActiveDebtPlan,
  getDebtPlanEligibleAccounts,
  getDebtPlanProjection,
  updateDebtPlan,
  type DebtPlanInput,
} from "@/actions/debt-plan-actions";
import { forecastKeys } from "@/hooks/useCashFlowForecast";
import { financialInsightKeys } from "@/hooks/useFinancialInsightQueries";
import { liabilityKeys } from "@/hooks/useLiabilityQueries";

export const debtPlanKeys = {
  all: ["debtPlans"] as const,
  active: () => [...debtPlanKeys.all, "active"] as const,
  projection: () => [...debtPlanKeys.all, "projection"] as const,
  eligibleAccounts: () => [...debtPlanKeys.all, "eligibleAccounts"] as const,
};

export function useActiveDebtPlan() {
  return useQuery({
    queryKey: debtPlanKeys.active(),
    queryFn: async () => {
      const result = await getActiveDebtPlan();
      if (!result.success) throw new Error(result.error);
      return result.data ?? null;
    },
  });
}

export function useDebtPlanProjection() {
  return useQuery({
    queryKey: debtPlanKeys.projection(),
    queryFn: async () => {
      const result = await getDebtPlanProjection();
      if (!result.success) throw new Error(result.error);
      return result.data ?? null;
    },
  });
}

export function useDebtPlanEligibleAccounts(enabled = true) {
  return useQuery({
    queryKey: debtPlanKeys.eligibleAccounts(),
    enabled,
    queryFn: async () => {
      const result = await getDebtPlanEligibleAccounts();
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

function invalidateDebtPlanQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: debtPlanKeys.all });
  qc.invalidateQueries({ queryKey: liabilityKeys.all });
  qc.invalidateQueries({ queryKey: financialInsightKeys.all });
  qc.invalidateQueries({ queryKey: forecastKeys.all });
}

export function useCreateDebtPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: DebtPlanInput) => {
      const result = await createDebtPlan(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => invalidateDebtPlanQueries(qc),
  });
}

export function useUpdateDebtPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DebtPlanInput }) => {
      const result = await updateDebtPlan(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => invalidateDebtPlanQueries(qc),
  });
}

export function useDeleteDebtPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteDebtPlan(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => invalidateDebtPlanQueries(qc),
  });
}
