"use client";

import { format, isToday, isTomorrow } from "date-fns";
import { CalendarClock, RefreshCw } from "lucide-react";

import type { SubscriptionSummaryItem } from "@/actions/subscription-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

function formatRenewalDate(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

export function UpcomingRenewalsCard({
  items,
}: {
  items: SubscriptionSummaryItem[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <CalendarClock className="h-4 w-4" />
          Upcoming Renewals
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No renewals in the next 30 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.provider || "No provider"} • {formatRenewalDate(new Date(item.nextBillingDate))}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm font-medium">
                  {formatCurrency(item.amount, item.currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
