import "server-only";

import { cache } from "react";
import { startOfMonth } from "date-fns";

import { sumNormalizedAmount } from "@/lib/transaction-aggregates";

export const getDashboardMonthSpending = cache(async (userId: string, nowIso: string): Promise<number> => {
  const now = new Date(nowIso);
  return sumNormalizedAmount({
    userId,
    types: ["EXPENSE", "LIABILITY_PAYMENT"],
    from: startOfMonth(now),
    to: now,
  });
});
