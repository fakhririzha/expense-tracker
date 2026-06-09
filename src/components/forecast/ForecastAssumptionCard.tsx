"use client";

import { AlertTriangle, Info } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CashFlowForecastResult } from "@/lib/forecasting/forecast-types";
import { formatDate } from "@/lib/utils";

interface ForecastAssumptionCardProps {
  forecast: CashFlowForecastResult;
}

export function ForecastAssumptionCard({
  forecast,
}: ForecastAssumptionCardProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Assumptions</CardTitle>
          <CardDescription>Rules used to build this projection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {forecast.assumptions.map((assumption) => (
            <div key={assumption.code} className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <p className="font-medium">{assumption.label}</p>
              </div>
              <p className="text-sm text-muted-foreground">{assumption.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Warnings</CardTitle>
          <CardDescription>Signals that reduce confidence or indicate risk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {forecast.warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No forecast warnings right now.</p>
          ) : (
            forecast.warnings.map((warning, index) => (
              <div key={`${warning.code}-${index}`} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      warning.severity === "danger"
                        ? "text-destructive"
                        : warning.severity === "warning"
                          ? "text-amber-600"
                          : "text-blue-600"
                    }`}
                  />
                  <p className="font-medium">{warning.message}</p>
                </div>
                {warning.date ? (
                  <p className="text-sm text-muted-foreground">
                    {formatDate(warning.date)}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
