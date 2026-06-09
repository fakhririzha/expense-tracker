import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createNetWorthSnapshotForCurrentUser,
  getNetWorthSnapshotByPeriod,
  getNetWorthSnapshotSummary,
  getNetWorthSnapshotTrend,
  getNetWorthSnapshots,
} from "@/actions/net-worth-snapshot-actions";
import { accountKeys } from "@/hooks/useAccountQueries";
import { reportKeys } from "@/hooks/useReportQueries";
import { sidebarMetricsKeys } from "@/hooks/useSidebarMetrics";

export const netWorthSnapshotKeys = {
  all: ["netWorthSnapshots"] as const,
  list: (params: {
    months?: number;
    startYear?: number;
    startMonth?: number;
    endYear?: number;
    endMonth?: number;
    currency?: string;
  }) => [...netWorthSnapshotKeys.all, "list", params] as const,
  summary: (params: { months?: number }) =>
    [...netWorthSnapshotKeys.all, "summary", params] as const,
  period: (year: number, month: number) =>
    [...netWorthSnapshotKeys.all, "period", { year, month }] as const,
  trend: (months: number, currency?: string) =>
    [...netWorthSnapshotKeys.all, "trend", { months, currency }] as const,
};

export function useNetWorthSnapshots(params: {
  months?: number;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  currency?: string;
}) {
  return useQuery({
    queryKey: netWorthSnapshotKeys.list(params),
    queryFn: async () => {
      const result = await getNetWorthSnapshots(params);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useNetWorthSnapshotSummary(months: number = 12) {
  return useQuery({
    queryKey: netWorthSnapshotKeys.summary({ months }),
    queryFn: async () => {
      const result = await getNetWorthSnapshotSummary({ months });
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
  });
}

export function useNetWorthTrend(months: number = 12, currency?: string) {
  return useQuery({
    queryKey: netWorthSnapshotKeys.trend(months, currency),
    queryFn: async () => {
      const result = await getNetWorthSnapshotTrend({ months, currency });
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useNetWorthSnapshotByPeriod(year: number, month: number) {
  return useQuery({
    queryKey: netWorthSnapshotKeys.period(year, month),
    queryFn: async () => {
      const result = await getNetWorthSnapshotByPeriod({ year, month });
      if (!result.success) throw new Error(result.error);
      return result.data ?? null;
    },
  });
}

export function useCreateNetWorthSnapshotForCurrentUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const result = await createNetWorthSnapshotForCurrentUser({ year, month });
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: netWorthSnapshotKeys.all });
      queryClient.invalidateQueries({ queryKey: reportKeys.all });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: sidebarMetricsKeys.all });
    },
  });
}
