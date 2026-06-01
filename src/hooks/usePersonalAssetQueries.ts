import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archivePersonalAsset,
  createPersonalAsset,
  deletePersonalAsset,
  getPersonalAssets,
  getPersonalAssetSummary,
  getPersonalAssetValuations,
  recordPersonalAssetValuation,
  restorePersonalAsset,
  updatePersonalAsset,
  type PersonalAssetInput,
  type PersonalAssetUpdateInput,
  type PersonalAssetValuationInput,
} from "@/actions/personal-asset-actions";
import { accountKeys } from "@/hooks/useAccountQueries";
import { reportKeys } from "@/hooks/useReportQueries";
import type { PersonalAssetCategory } from "@/types/personal-assets";

export const personalAssetKeys = {
  all: ["personal-assets"] as const,
  lists: () => [...personalAssetKeys.all, "list"] as const,
  list: (params?: { status?: string; category?: string }) =>
    [...personalAssetKeys.lists(), params] as const,
  summary: () => [...personalAssetKeys.all, "summary"] as const,
  valuations: (assetId: string) =>
    [...personalAssetKeys.all, "valuations", assetId] as const,
};

export function usePersonalAssets(params?: {
  status?: "active" | "archived" | "all";
  category?: PersonalAssetCategory;
}) {
  return useQuery({
    queryKey: personalAssetKeys.list(params),
    queryFn: async () => {
      const result = await getPersonalAssets(params);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function usePersonalAssetSummary() {
  return useQuery({
    queryKey: personalAssetKeys.summary(),
    queryFn: async () => {
      const result = await getPersonalAssetSummary();
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
  });
}

export function usePersonalAssetValuations(assetId?: string) {
  return useQuery({
    queryKey: personalAssetKeys.valuations(assetId ?? ""),
    queryFn: async () => {
      if (!assetId) return [];
      const result = await getPersonalAssetValuations(assetId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!assetId,
  });
}

function useInvalidatePersonalAssets() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: personalAssetKeys.all });
    queryClient.invalidateQueries({ queryKey: accountKeys.all });
    queryClient.invalidateQueries({ queryKey: reportKeys.all });
  };
}

export function useCreatePersonalAsset() {
  const invalidate = useInvalidatePersonalAssets();
  return useMutation({
    mutationFn: async (data: PersonalAssetInput) => {
      const result = await createPersonalAsset(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePersonalAsset() {
  const invalidate = useInvalidatePersonalAssets();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: PersonalAssetUpdateInput;
    }) => {
      const result = await updatePersonalAsset(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export function useRecordPersonalAssetValuation() {
  const invalidate = useInvalidatePersonalAssets();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: PersonalAssetValuationInput;
    }) => {
      const result = await recordPersonalAssetValuation(id, data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: invalidate,
  });
}

export function useArchivePersonalAsset() {
  const invalidate = useInvalidatePersonalAssets();
  return useMutation({
    mutationFn: async ({ id, disposedAt }: { id: string; disposedAt: Date }) => {
      const result = await archivePersonalAsset(id, { disposedAt });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: invalidate,
  });
}

export function useRestorePersonalAsset() {
  const invalidate = useInvalidatePersonalAssets();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await restorePersonalAsset(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: invalidate,
  });
}

export function useDeletePersonalAsset() {
  const invalidate = useInvalidatePersonalAssets();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deletePersonalAsset(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: invalidate,
  });
}
