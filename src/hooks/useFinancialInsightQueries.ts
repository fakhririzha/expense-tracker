import { useQuery } from "@tanstack/react-query";

import {
  getFinancialInsights,
  type GetFinancialInsightsInput,
} from "@/actions/insight-actions";

function getCurrentInsightPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const financialInsightKeys = {
  all: ["financial-insights"] as const,
  current: (
    scope: "dashboard",
    limit: number | undefined,
    periodKey: string,
    includeTypes?: NonNullable<GetFinancialInsightsInput>["includeTypes"]
  ) =>
    [...financialInsightKeys.all, "current", { scope, limit, periodKey, includeTypes }] as const,
};

export function useFinancialInsights(input?: GetFinancialInsightsInput) {
  const scope = input?.scope ?? "dashboard";
  const periodKey = getCurrentInsightPeriodKey();

  return useQuery({
    queryKey: financialInsightKeys.current(
      scope,
      input?.limit,
      periodKey,
      input?.includeTypes
    ),
    queryFn: async () => {
      const result = await getFinancialInsights(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
  });
}
