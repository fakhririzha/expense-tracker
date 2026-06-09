import { isLiquidAccountType } from "@/lib/account-types";
import type { ForecastAccountRef } from "@/lib/forecasting/forecast-events";
import type { ForecastEvent } from "@/lib/forecasting/forecast-types";
import { roundMoney } from "@/lib/forecasting/forecast-periods";

export function getTrackedLiquidAccountIds(
  accounts: ForecastAccountRef[],
  selectedAccountIds?: string[]
): Set<string> {
  const selectable = new Set(selectedAccountIds ?? []);
  const tracked = accounts
    .filter(
      (account) =>
        account.isActive &&
        isLiquidAccountType(account.type) &&
        (selectable.size === 0 || selectable.has(account.id))
    )
    .map((account) => account.id);

  return new Set(tracked);
}

export function getStartingBalanceBeforeFutureTransactions(
  currentLiquidBalance: number,
  futureTransactionEvents: ForecastEvent[]
): {
  startingBalance: number;
  adjustedAmount: number;
} {
  const signedFutureImpact = futureTransactionEvents.reduce((sum, event) => {
    if (event.excludedFromProjection || event.amountInMainCurrency === null) {
      return sum;
    }

    return (
      sum +
      (event.direction === "inflow"
        ? event.amountInMainCurrency
        : -event.amountInMainCurrency)
    );
  }, 0);

  return {
    startingBalance: roundMoney(currentLiquidBalance - signedFutureImpact),
    adjustedAmount: roundMoney(signedFutureImpact),
  };
}
