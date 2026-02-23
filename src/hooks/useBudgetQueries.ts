import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBudgetsSummary,
  getBudgetVsActual,
  getBudgetTransactions,
  createBudget,
  updateBudget,
  deleteBudget,
  type BudgetInput,
} from "@/actions/budget-actions";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const budgetKeys = {
  all: ["budgets"] as const,
  summary: () => [...budgetKeys.all, "summary"] as const,
  vsActual: () => [...budgetKeys.all, "vsActual"] as const,
  transactions: (budgetId: string) =>
    [...budgetKeys.all, "transactions", budgetId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useBudgetsSummary() {
  return useQuery({
    queryKey: budgetKeys.summary(),
    queryFn: async () => {
      const result = await getBudgetsSummary();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useBudgetVsActual() {
  return useQuery({
    queryKey: budgetKeys.vsActual(),
    queryFn: async () => {
      const result = await getBudgetVsActual();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useBudgetTransactions(budgetId: string) {
  return useQuery({
    queryKey: budgetKeys.transactions(budgetId),
    queryFn: async () => {
      const result = await getBudgetTransactions(budgetId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!budgetId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: BudgetInput) => {
      const result = await createBudget(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BudgetInput> }) => {
      const result = await updateBudget(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteBudget(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
