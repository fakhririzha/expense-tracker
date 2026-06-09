"use client";

import { CreditCard, CalendarClock, Wallet, Hourglass } from "lucide-react";

import type { SubscriptionSummary } from "@/actions/subscription-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function SubscriptionSummaryCards({
  summary,
}: {
  summary?: SubscriptionSummary;
}) {
  const displayCurrency = summary?.displayCurrency ?? "IDR";

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Subscription Spend</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(summary?.totalMonthlyCost ?? 0, displayCurrency)}
          </div>
          <p className="text-xs text-muted-foreground">
            Active subscriptions only
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Projected Yearly Spend</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(summary?.projectedYearlyCost ?? 0, displayCurrency)}
          </div>
          <p className="text-xs text-muted-foreground">
            Based on active billing cycles
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary?.activeCount ?? 0}</div>
          <p className="text-xs text-muted-foreground">
            {summary?.upcomingRenewals.length ?? 0} renewal(s) in the next 30 days
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trials Ending Soon</CardTitle>
          <Hourglass className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary?.trialEndingSoonCount ?? 0}</div>
          <p className="text-xs text-muted-foreground">
            {summary?.rateFallbackCount
              ? `${summary.rateFallbackCount} FX estimate(s) used`
              : "No FX fallbacks in current totals"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
