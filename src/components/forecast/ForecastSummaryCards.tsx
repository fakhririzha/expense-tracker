"use client";

import { ArrowDownRight, ArrowUpRight, CalendarRange, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CashFlowForecastResult } from "@/lib/forecasting/forecast-types";

interface ForecastSummaryCardsProps {
  forecast: CashFlowForecastResult;
}

export function ForecastSummaryCards({
  forecast,
}: ForecastSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Starting Liquid Balance</CardTitle>
          <Wallet className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(forecast.startingLiquidBalance, forecast.currency)}
          </div>
          <p className="text-xs text-muted-foreground">As of today</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ending Balance</CardTitle>
          <CalendarRange className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(forecast.endingProjectedBalance, forecast.currency)}
          </div>
          <p className="text-xs text-muted-foreground">
            End of {forecast.horizonDays}-day horizon
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lowest Balance</CardTitle>
          <ArrowDownRight className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(forecast.lowestProjectedBalance, forecast.currency)}
          </div>
          <p className="text-xs text-muted-foreground">
            {forecast.lowestProjectedBalanceDate
              ? formatDate(forecast.lowestProjectedBalanceDate)
              : "No balance dip in range"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
          <ArrowUpRight
            className={`h-4 w-4 ${
              forecast.netCashFlow >= 0 ? "text-green-600" : "text-destructive"
            }`}
          />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              forecast.netCashFlow >= 0 ? "text-green-600" : "text-destructive"
            }`}
          >
            {forecast.netCashFlow >= 0 ? "+" : ""}
            {formatCurrency(forecast.netCashFlow, forecast.currency)}
          </div>
          <p className="text-xs text-muted-foreground">
            Inflow {formatCurrency(forecast.totalInflow, forecast.currency)} / Outflow{" "}
            {formatCurrency(forecast.totalOutflow, forecast.currency)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
