"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";

import type { UpcomingBankPressureAlert as UpcomingBankPressureAlertData } from "@/actions/schedule-pressure-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency, formatDate } from "@/lib/utils";

interface UpcomingBankPressureAlertProps {
  alerts: UpcomingBankPressureAlertData[];
}

export function UpcomingBankPressureAlert({
  alerts,
}: UpcomingBankPressureAlertProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <Alert
      className="border-amber-300 text-amber-950 [&>svg]:text-amber-600"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Upcoming bank outflows exceed current balance</AlertTitle>
      <AlertDescription className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.accountId} className="rounded-md border border-amber-200/80 bg-amber-50/60 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{alert.accountName}</p>
                <p className="text-sm text-amber-900/80">
                  Balance {formatCurrency(alert.currentBalance, alert.currency)} • upcoming{" "}
                  {formatCurrency(alert.upcomingOutflowTotal, alert.currency)}
                </p>
              </div>
              <p className="text-sm font-semibold">
                Shortfall {formatCurrency(alert.shortfall, alert.currency)}
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {alert.items.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {item.label}
                      {item.managedBySubscription ? " • managed by subscription" : ""}
                    </p>
                    <p className="flex items-center gap-1 text-amber-900/80">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {formatDate(item.dueDate)} •{" "}
                      {item.source === "subscription" ? "subscription" : "recurring rule"}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatCurrency(item.convertedAmount, alert.currency)}
                  </p>
                </div>
              ))}

              {alert.items.length > 5 ? (
                <p className="text-sm text-amber-900/80">
                  {alert.items.length - 5} more scheduled outflow(s) in this 30-day window.
                </p>
              ) : null}

              {alert.missingConversionCount > 0 ? (
                <p className="text-sm text-amber-900/80">
                  {alert.missingConversionCount} item(s) were excluded because exchange rates were unavailable.
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </AlertDescription>
    </Alert>
  );
}
