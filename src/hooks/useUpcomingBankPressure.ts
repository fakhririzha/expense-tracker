import { useQuery } from "@tanstack/react-query";

import { getUpcomingBankPressure } from "@/actions/schedule-pressure-actions";

export const upcomingBankPressureKeys = {
  all: ["upcoming-bank-pressure"] as const,
  list: (days: number) => [...upcomingBankPressureKeys.all, { days }] as const,
};

export function useUpcomingBankPressure(days: number = 30) {
  return useQuery({
    queryKey: upcomingBankPressureKeys.list(days),
    queryFn: async () => {
      const result = await getUpcomingBankPressure(days);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data ?? [];
    },
  });
}
