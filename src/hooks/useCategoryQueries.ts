import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type CategoryInput,
} from "@/actions/category-actions";
import { budgetKeys } from "./useBudgetQueries";
import { recurringKeys } from "./useRecurringQueries";
import { reportKeys } from "./useReportQueries";
import { transactionKeys } from "./useTransactionQueries";

export const categoryKeys = {
  all: ["categories"] as const,
  list: (type?: "INCOME" | "EXPENSE") =>
    [...categoryKeys.all, "list", { type }] as const,
};

export function useCategories(type?: "INCOME" | "EXPENSE") {
  return useQuery({
    queryKey: categoryKeys.list(type),
    queryFn: async () => {
      const result = await getCategories(type);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

function invalidateCategoryConsumers(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: categoryKeys.all });
  qc.invalidateQueries({ queryKey: transactionKeys.all });
  qc.invalidateQueries({ queryKey: budgetKeys.all });
  qc.invalidateQueries({ queryKey: recurringKeys.all });
  qc.invalidateQueries({ queryKey: reportKeys.all });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CategoryInput) => {
      const result = await createCategory(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      invalidateCategoryConsumers(qc);
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CategoryInput> }) => {
      const result = await updateCategory(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      invalidateCategoryConsumers(qc);
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteCategory(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      invalidateCategoryConsumers(qc);
    },
  });
}
