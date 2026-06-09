"use client";

import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CashFlowForecastResult } from "@/lib/forecasting/forecast-types";

interface ForecastRiskAlertProps {
  forecast: CashFlowForecastResult;
}

export function ForecastRiskAlert({ forecast }: ForecastRiskAlertProps) {
  const topWarning = forecast.warnings[0];

  if (forecast.status === "safe") {
    return (
      <Alert>
        <ShieldCheck className="h-4 w-4 text-green-600" />
        <AlertTitle>Cash position looks stable</AlertTitle>
        <AlertDescription>
          {topWarning?.message ?? "Projected liquid cash stays above your warning thresholds in this window."}
        </AlertDescription>
      </Alert>
    );
  }

  const isNegative = forecast.status === "negative";
  const title =
    forecast.status === "watch"
      ? "Cash buffer is getting tight"
      : isNegative
        ? "Projected negative balance"
        : "Cash pressure is elevated";

  return (
    <Alert
      variant={isNegative ? "destructive" : "default"}
      className={!isNegative ? "border-amber-300 text-amber-900 [&>svg]:text-amber-600" : undefined}
    >
      {isNegative ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {topWarning?.message ?? "Review upcoming outflows and your projected balance curve."}
      </AlertDescription>
    </Alert>
  );
}
