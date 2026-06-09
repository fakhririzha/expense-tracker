import type {
  DailyForecastBalance,
  ForecastEvent,
} from "@/lib/forecasting/forecast-types";
import { roundMoney } from "@/lib/forecasting/forecast-periods";

export function summarizeForecast(
  dailyBalances: DailyForecastBalance[],
  events: ForecastEvent[]
) {
  const totalInflow = roundMoney(
    events.reduce((sum, event) => {
      if (
        event.direction !== "inflow" ||
        event.excludedFromProjection ||
        event.amountInMainCurrency === null
      ) {
        return sum;
      }
      return sum + event.amountInMainCurrency;
    }, 0)
  );

  const totalOutflow = roundMoney(
    events.reduce((sum, event) => {
      if (
        event.direction !== "outflow" ||
        event.excludedFromProjection ||
        event.amountInMainCurrency === null
      ) {
        return sum;
      }
      return sum + event.amountInMainCurrency;
    }, 0)
  );

  let lowestProjectedBalance = dailyBalances[0]?.endingBalance ?? 0;
  let lowestProjectedBalanceDate = dailyBalances[0]?.date ?? null;

  for (const day of dailyBalances) {
    if (day.endingBalance < lowestProjectedBalance) {
      lowestProjectedBalance = day.endingBalance;
      lowestProjectedBalanceDate = day.date;
    }
  }

  return {
    totalInflow,
    totalOutflow,
    netCashFlow: roundMoney(totalInflow - totalOutflow),
    endingProjectedBalance:
      dailyBalances[dailyBalances.length - 1]?.endingBalance ?? 0,
    lowestProjectedBalance: roundMoney(lowestProjectedBalance),
    lowestProjectedBalanceDate,
  };
}
