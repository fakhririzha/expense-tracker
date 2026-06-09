"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPeriodLabel } from "@/lib/net-worth-period";
import type { NetWorthSnapshotSummary } from "@/lib/net-worth-types";
import { formatCurrency, formatPercentage } from "@/lib/utils";

interface NetWorthSnapshotSummaryCardProps {
  summary: NetWorthSnapshotSummary;
}

export function NetWorthSnapshotSummaryCard({
  summary,
}: NetWorthSnapshotSummaryCardProps) {
  if (!summary.latestSnapshot || !summary.currency) {
    return null;
  }

  const change = summary.netWorthChange;
  const latestPeriod = getPeriodLabel({
    year: summary.latestSnapshot.periodYear,
    month: summary.latestSnapshot.periodMonth,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Month-End Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{latestPeriod}</p>
          <p
            className={`text-2xl font-bold ${
              summary.latestSnapshot.netWorth >= 0
                ? "text-blue-600"
                : "text-destructive"
            }`}
          >
            {formatCurrency(summary.latestSnapshot.netWorth, summary.currency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Month-over-month</p>
          <p
            className={`text-2xl font-bold ${
              (change ?? 0) >= 0 ? "text-green-600" : "text-destructive"
            }`}
          >
            {change === null
              ? "N/A"
              : `${change >= 0 ? "+" : ""}${formatCurrency(change, summary.currency)}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.netWorthChangePercent === null
              ? "Need a previous snapshot"
              : `${formatPercentage(summary.netWorthChangePercent)} vs previous month`}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Highest net worth</p>
          <p className="text-2xl font-bold text-green-600">
            {summary.highNetWorth === null
              ? "N/A"
              : formatCurrency(summary.highNetWorth, summary.currency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Lowest net worth</p>
          <p
            className={`text-2xl font-bold ${
              (summary.lowNetWorth ?? 0) >= 0
                ? "text-blue-600"
                : "text-destructive"
            }`}
          >
            {summary.lowNetWorth === null
              ? "N/A"
              : formatCurrency(summary.lowNetWorth, summary.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.hasCurrencyMismatch
              ? "Mixed snapshot currencies detected"
              : `${summary.count} snapshot${summary.count === 1 ? "" : "s"}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
