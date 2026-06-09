import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
} from "@/actions/recurring-actions";
import { forecastKeys } from "@/hooks/useCashFlowForecast";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const recurringKeys = {
  all: ["recurring"] as const,
  list: () => [...recurringKeys.all, "list"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useRecurringRules() {
  return useQuery({
    queryKey: recurringKeys.list(),
    queryFn: async () => {
      const result = await getRecurringRules();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateRecurringRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Parameters<typeof createRecurringRule>[0]) => {
      const result = await createRecurringRule(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
    },
  });
}

export function useUpdateRecurringRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateRecurringRule>[1];
    }) => {
      const result = await updateRecurringRule(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
    },
  });
}

export function useDeleteRecurringRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteRecurringRule(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recurringKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
    },
  });
}
