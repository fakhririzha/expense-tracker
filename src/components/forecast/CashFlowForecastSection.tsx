"use client";

import { useMemo, useState } from "react";

import { ForecastAssumptionCard } from "@/components/forecast/ForecastAssumptionCard";
import { ForecastEmptyState } from "@/components/forecast/ForecastEmptyState";
import { ForecastEventList } from "@/components/forecast/ForecastEventList";
import { ForecastPeriodSelector } from "@/components/forecast/ForecastPeriodSelector";
import { ForecastRiskAlert } from "@/components/forecast/ForecastRiskAlert";
import { ForecastSkeleton } from "@/components/forecast/ForecastSkeleton";
import { ForecastSummaryCards } from "@/components/forecast/ForecastSummaryCards";
import { ProjectedBalanceChart } from "@/components/forecast/ProjectedBalanceChart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCashFlowForecast } from "@/hooks/useCashFlowForecast";
import type {
  ForecastHorizonDays,
  ForecastVariableSpendingMode,
} from "@/lib/forecasting/forecast-types";

export function CashFlowForecastSection() {
  const [horizonDays, setHorizonDays] = useState<ForecastHorizonDays>(30);
  const [variableSpendingMode, setVariableSpendingMode] =
    useState<ForecastVariableSpendingMode>("historical");
  const [includeFutureTransactions, setIncludeFutureTransactions] = useState(true);
  const [includeRecurringTransactions, setIncludeRecurringTransactions] = useState(true);
  const [includeSubscriptions, setIncludeSubscriptions] = useState(true);

  const queryInput = useMemo(
    () => ({
      horizonDays,
      variableSpendingMode,
      includeFutureTransactions,
      includeRecurringTransactions,
      includeSubscriptions,
    }),
    [
      horizonDays,
      includeFutureTransactions,
      includeRecurringTransactions,
      includeSubscriptions,
      variableSpendingMode,
    ]
  );

  const { data, isLoading, error } = useCashFlowForecast(queryInput);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Forecast</CardTitle>
          <CardDescription>
            Project liquid cash pressure from scheduled transactions, recurring rules, subscriptions, and optional spending estimates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <ForecastPeriodSelector value={horizonDays} onChange={setHorizonDays} />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Variable spending</Label>
                <Select
                  value={variableSpendingMode}
                  onValueChange={(value) =>
                    setVariableSpendingMode(value as ForecastVariableSpendingMode)
                  }
                >
                  <SelectTrigger className="w-full min-w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="historical">Historical estimate</SelectItem>
                    <SelectItem value="budget">Budget pacing</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <Label htmlFor="future-transactions">Future transactions</Label>
                <Switch
                  id="future-transactions"
                  checked={includeFutureTransactions}
                  onCheckedChange={setIncludeFutureTransactions}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <Label htmlFor="recurring-transactions">Recurring rules</Label>
                <Switch
                  id="recurring-transactions"
                  checked={includeRecurringTransactions}
                  onCheckedChange={setIncludeRecurringTransactions}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <Label htmlFor="subscriptions">Subscriptions</Label>
                <Switch
                  id="subscriptions"
                  checked={includeSubscriptions}
                  onCheckedChange={setIncludeSubscriptions}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <ForecastSkeleton /> : null}

      {!isLoading && error ? (
        <Alert variant="destructive">
          <AlertTitle>Forecast unavailable</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && data ? (
        data.dailyBalances.length === 0 ? (
          <ForecastEmptyState
            title="Nothing to project yet"
            description={data.warnings[0]?.message ?? "Add an active bank or cash account to start forecasting liquid cash flow."}
          />
        ) : (
          <div className="space-y-6">
            <ForecastSummaryCards forecast={data} />
            <ForecastRiskAlert forecast={data} />
            <ProjectedBalanceChart forecast={data} />
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <ForecastEventList forecast={data} />
              <ForecastAssumptionCard forecast={data} />
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
