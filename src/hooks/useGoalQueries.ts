import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGoalsSummary,
  getGoalsStats,
  createGoal,
  updateGoal,
  deleteGoal,
  addProgress,
  withdrawProgress,
  type GoalInput,
} from "@/actions/goal-actions";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const goalKeys = {
  all: ["goals"] as const,
  summary: () => [...goalKeys.all, "summary"] as const,
  stats: () => [...goalKeys.all, "stats"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useGoalsSummary() {
  return useQuery({
    queryKey: goalKeys.summary(),
    queryFn: async () => {
      const result = await getGoalsSummary();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useGoalsStats() {
  return useQuery({
    queryKey: goalKeys.stats(),
    queryFn: async () => {
      const result = await getGoalsStats();
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: GoalInput) => {
      const result = await createGoal(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GoalInput> }) => {
      const result = await updateGoal(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteGoal(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useAddProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const result = await addProgress(id, amount);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useWithdrawProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const result = await withdrawProgress(id, amount);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}
