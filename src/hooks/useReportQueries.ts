import { useQuery } from "@tanstack/react-query";
import {
  getSpendingTrends,
  getCategoryBreakdown,
  getIncomeVsExpense,
  getMonthlySummary,
} from "@/actions/report-actions";

// ---------------------------------------------------------------------------
// Query Key Factory
// ---------------------------------------------------------------------------
export const reportKeys = {
  all: ["reports"] as const,
  spendingTrends: (params: { startDate?: Date; endDate?: Date; groupBy?: string }) =>
    [...reportKeys.all, "spendingTrends", params] as const,
  categoryBreakdown: (params: { startDate?: Date; endDate?: Date; type?: string }) =>
    [...reportKeys.all, "categoryBreakdown", params] as const,
  incomeVsExpense: (months: number) =>
    [...reportKeys.all, "incomeVsExpense", { months }] as const,
  monthlySummary: (year: number, month: number) =>
    [...reportKeys.all, "monthlySummary", { year, month }] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useSpendingTrends(params: {
  startDate: Date;
  endDate: Date;
  groupBy: "day" | "week" | "month";
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params;
  return useQuery({
    queryKey: reportKeys.spendingTrends(queryParams),
    queryFn: async () => {
      const result = await getSpendingTrends(queryParams);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    enabled,
  });
}

export function useCategoryBreakdown(params: {
  startDate: Date;
  endDate: Date;
  type: "INCOME" | "EXPENSE";
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params;
  return useQuery({
    queryKey: reportKeys.categoryBreakdown(queryParams),
    queryFn: async () => {
      const result = await getCategoryBreakdown(queryParams);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    enabled,
  });
}

export function useIncomeVsExpense(months: number, enabled: boolean = true) {
  return useQuery({
    queryKey: reportKeys.incomeVsExpense(months),
    queryFn: async () => {
      const result = await getIncomeVsExpense({ months });
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    enabled,
  });
}

export function useReportMonthlySummary(
  year: number,
  month: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: reportKeys.monthlySummary(year, month),
    queryFn: async () => {
      const result = await getMonthlySummary({ year, month });
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    enabled,
  });
}
