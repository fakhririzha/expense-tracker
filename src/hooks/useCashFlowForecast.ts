import { useQuery } from "@tanstack/react-query";

import {
  getCashFlowForecast,
} from "@/actions/forecast-actions";
import type { GetCashFlowForecastInput } from "@/lib/forecasting/forecast-types";

export const forecastKeys = {
  all: ["forecast"] as const,
  cashFlow: (input: GetCashFlowForecastInput) =>
    [...forecastKeys.all, "cash-flow", input] as const,
};

export function useCashFlowForecast(
  input: GetCashFlowForecastInput,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: forecastKeys.cashFlow(input),
    queryFn: async () => {
      const result = await getCashFlowForecast(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}
