import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAccounts,
  getAccountsSummary,
  createAccount,
  updateAccount,
  deleteAccount,
  type AccountInput,
} from "@/actions/account-actions";
import { forecastKeys } from "@/hooks/useCashFlowForecast";
import { upcomingBankPressureKeys } from "@/hooks/useUpcomingBankPressure";
import { type AccountTypeValue } from "@/lib/account-types";
import { type AccountMutationConfirmation } from "@/lib/account-mutation-totp";

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
        type as AccountTypeValue | undefined
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
    mutationFn: async ({
      data,
      confirmation,
    }: {
      data: AccountInput;
      confirmation?: AccountMutationConfirmation;
    }) => {
      const result = await createAccount(data, confirmation);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
      qc.invalidateQueries({ queryKey: upcomingBankPressureKeys.all });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
      confirmation,
    }: {
      id: string;
      data: Partial<AccountInput>;
      confirmation?: AccountMutationConfirmation;
    }) => {
      const result = await updateAccount(id, data, confirmation);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
      qc.invalidateQueries({ queryKey: upcomingBankPressureKeys.all });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      confirmation,
    }: {
      id: string;
      confirmation?: AccountMutationConfirmation;
    }) => {
      const result = await deleteAccount(id, confirmation);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all });
      qc.invalidateQueries({ queryKey: forecastKeys.all });
      qc.invalidateQueries({ queryKey: upcomingBankPressureKeys.all });
    },
  });
}
