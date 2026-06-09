"use client";

import { differenceInCalendarDays, format } from "date-fns";
import { FlaskConical, Hourglass } from "lucide-react";

import type { SubscriptionSummaryItem } from "@/actions/subscription-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function getDaysLabel(date: Date): string {
  const days = differenceInCalendarDays(date, new Date());
  if (days <= 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `${days} days left`;
}

export function TrialEndingSoonCard({
  items,
}: {
  items: SubscriptionSummaryItem[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Hourglass className="h-4 w-4" />
          Trial Ending Soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FlaskConical className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No trials ending in the next 7 days</p>
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
                    {item.provider || "No provider"} •{" "}
                    {item.trialEndDate ? format(new Date(item.trialEndDate), "EEE, MMM d") : "No trial date"}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm font-medium">
                  {item.trialEndDate ? getDaysLabel(new Date(item.trialEndDate)) : "No date"}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
