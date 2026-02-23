import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAccounts,
  getAccountsSummary,
  createAccount,
  updateAccount,
  deleteAccount,
  type AccountInput,
} from "@/actions/account-actions";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const accountKeys = {
  all: ["accounts"] as const,
  lists: () => [...accountKeys.all, "list"] as const,
  list: (type?: string) => [...accountKeys.lists(), { type }] as const,
  summary: () => [...accountKeys.all, "summary"] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAccounts(type?: string) {
  return useQuery({
    queryKey: accountKeys.list(type),
    queryFn: async () => {
      const result = await getAccounts(
        type as "BANK" | "CASH" | "INVESTMENT" | "LOAN" | "CREDIT_CARD" | undefined
      );
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useAccountsSummary() {
  return useQuery({
    queryKey: accountKeys.summary(),
    queryFn: async () => {
      const result = await getAccountsSummary();
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AccountInput) => {
      const result = await createAccount(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AccountInput> }) => {
      const result = await updateAccount(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteAccount(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
